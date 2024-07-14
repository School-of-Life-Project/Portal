use std::{collections::HashSet, ffi::OsString, path::PathBuf};

use futures_util::{future::join_all, try_join};
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{
    wrapper::ErrorWrapper, Course, CourseCompletion, CourseMap, CourseProgress, CourseTimeOffsets,
    OverallProgress, Settings,
};

use crate::{
    data::{self, ConfigFile, DataManager, Error, GraphFile, ResourceManager, WritableConfigFile},
    MAX_FS_CONCURRENCY,
};

pub(super) struct State {
    pub(super) data_dir: PathBuf,
    course_maps: DataManager,
    courses: ResourceManager,
    completion: DataManager,
    active_courses: Mutex<WritableConfigFile>,
    overall_progress: Mutex<WritableConfigFile>,
    settings: Mutex<WritableConfigFile>,
    offsets: Mutex<WritableConfigFile>,
}

impl State {
    pub(super) async fn new() -> Result<Self, Error> {
        let data_dir = data::get_data_dir(crate::IDENTIFIER)?;

        let course_map_path = data_dir.join("Course Maps");
        let course_path = data_dir.join("Courses");
        let completion_path = data_dir.join("Progress Data");
        let overall_progress_path = completion_path.join("total.toml");
        let progress_offset_path = completion_path.join("offsets.toml");
        let active_courses_path = data_dir.join("Active Courses.toml");
        let settings_path = data_dir.join("Settings.toml");

        let (course_maps, courses, completion, active_courses, settings) = try_join!(
            DataManager::new(course_map_path, Some(OsString::from("dot"))),
            ResourceManager::new(course_path),
            DataManager::new(completion_path, Some(OsString::from("toml"))),
            WritableConfigFile::new(active_courses_path),
            WritableConfigFile::new(settings_path),
        )?;
        let (overall_progress, offsets) = try_join!(
            WritableConfigFile::new(overall_progress_path),
            WritableConfigFile::new(progress_offset_path)
        )?;

        Ok(Self {
            data_dir,
            course_maps,
            courses,
            completion,
            active_courses: Mutex::new(active_courses),
            overall_progress: Mutex::new(overall_progress),
            settings: Mutex::new(settings),
            offsets: Mutex::new(offsets),
        })
    }
    async fn get_course_index(&self, id: Uuid) -> Result<Course, Error> {
        let root = self.courses.get(id);

        let mut file = ConfigFile::new(root.join("course.toml")).await?;

        let mut course = file.read::<Course>().await?;

        course.update_root(&root, id);

        Ok(course)
    }
    pub(super) async fn get_course(&self, id: Uuid) -> Result<(Course, CourseCompletion), Error> {
        let mut offsets_file = self.offsets.lock().await;

        let ((course, mut completion), mut offsets) = try_join!(
            self.hydrate_course(id),
            offsets_file.read::<CourseTimeOffsets>()
        )?;

        completion.time_spent -= offsets.today(&course, &completion);

        offsets_file.write(&offsets).await?;

        Ok((course, completion))
    }
    async fn hydrate_course(&self, id: Uuid) -> Result<(Course, CourseCompletion), Error> {
        try_join!(self.get_course_index(id), async {
            let path = self.completion.get(id);
            match ConfigFile::new(path).await {
                Ok(mut file) => file.read().await,
                Err(err) => {
                    if err.is_not_found() {
                        Ok(CourseCompletion::default())
                    } else {
                        Err(err)
                    }
                }
            }
        })
    }
    pub(super) async fn get_courses(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, Error> {
        self.hydrate_course_list(self.courses.scan().await?).await
    }
    pub(super) async fn get_courses_active(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, Error> {
        let mut file = self.active_courses.lock().await;

        let course_list: HashSet<Uuid> = file.read().await?;

        self.hydrate_course_list(course_list).await
    }
    async fn hydrate_course_list(
        &self,
        course_list: HashSet<Uuid>,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, Error> {
        let course_list: Vec<Uuid> = course_list.into_iter().collect();

        let mut courses = Vec::with_capacity(course_list.len());

        let mut offsets_file = self.offsets.lock().await;
        let mut offsets = offsets_file.read().await?;

        for course_chunk in course_list.chunks(MAX_FS_CONCURRENCY / 2) {
            let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY / 2);

            for course in course_chunk {
                future_set.push(self.hydrate_course(*course));
            }

            let results = join_all(future_set).await;

            for (index, result) in results.into_iter().enumerate() {
                courses.push(match result {
                    Ok((mut course, completion)) => {
                        course.remove_resources();
                        let progress =
                            CourseProgress::calculate(&course, &completion, &mut offsets);
                        Ok((course, progress))
                    }
                    Err(err) => Err(ErrorWrapper::new(
                        format!("Unable to get Course {}", course_chunk[index]),
                        &err,
                    )),
                });
            }
        }

        offsets_file.write(&offsets).await?;

        Ok(courses)
    }
    pub(super) async fn get_course_maps(
        &self,
    ) -> Result<Vec<Result<CourseMap, ErrorWrapper>>, Error> {
        let course_map_list: Vec<Uuid> = self.course_maps.scan().await?.into_iter().collect();

        let mut course_maps = Vec::with_capacity(course_map_list.len());

        for course_map_chunk in course_map_list.chunks(MAX_FS_CONCURRENCY) {
            let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY);

            for course_map in course_map_chunk {
                future_set.push(self.get_course_map(*course_map));
            }

            let results = join_all(future_set).await;

            for (index, result) in results.into_iter().enumerate() {
                course_maps.push(result.map_err(|err| {
                    ErrorWrapper::new(
                        format!("Unable to get CourseMap {}", course_map_chunk[index]),
                        &err,
                    )
                }));
            }
        }

        Ok(course_maps)
    }
    async fn get_course_map(&self, id: Uuid) -> Result<CourseMap, Error> {
        let path = self.course_maps.get(id);

        let mut file = GraphFile::new(path).await?;
        let (graph, graphed) = file.read().await?;

        Ok(CourseMap::new(id, &graph, graphed))
    }
    pub(super) async fn set_course_active_status(&self, id: Uuid, data: bool) -> Result<(), Error> {
        let mut file = self.active_courses.lock().await;

        let mut active_courses: HashSet<Uuid> = file.read().await?;

        if data {
            active_courses.insert(id);
        } else {
            active_courses.remove(&id);
        }

        file.write(&active_courses).await
    }
    pub(super) async fn set_course_completion(
        &self,
        id: Uuid,
        mut data: CourseCompletion,
    ) -> Result<(), Error> {
        let time_change_secs;
        let chapter_change;

        {
            let ((mut offsets_file, mut offsets), course, (mut completion_file, old_completion)) =
                try_join!(
                    async {
                        let mut offsets_file = self.offsets.lock().await;
                        let offsets: CourseTimeOffsets = offsets_file.read().await?;

                        Ok((offsets_file, offsets))
                    },
                    self.get_course_index(id),
                    async {
                        let completion_path = self.completion.get(id);

                        let mut completion_file = WritableConfigFile::new(completion_path).await?;
                        let old_completion = completion_file.read().await?;

                        Ok((completion_file, old_completion))
                    }
                )?;

            data.time_spent += offsets.today(&course, &old_completion);

            let old_progress = CourseProgress::calculate(&course, &old_completion, &mut offsets);
            let new_progress = CourseProgress::calculate(&course, &data, &mut offsets);

            try_join!(completion_file.write(&data), offsets_file.write(&offsets))?;

            time_change_secs = CourseCompletion::calculate_time_diff_secs(&old_completion, &data);
            chapter_change = CourseProgress::calculate_chapter_diff(&old_progress, &new_progress);
        }

        let mut total_progress_file = self.overall_progress.lock().await;

        let mut total_progress: OverallProgress = total_progress_file.read().await?;
        total_progress.update(chapter_change, time_change_secs);
        total_progress_file.write(&total_progress).await
    }
    pub(super) async fn get_settings(&self) -> Result<Settings, Error> {
        let mut file = self.settings.lock().await;
        file.read().await
    }
    pub(super) async fn set_settings(&self, data: &Settings) -> Result<(), Error> {
        let mut file = self.settings.lock().await;
        file.write(data).await
    }
    pub(super) async fn get_overall_progress(&self) -> Result<OverallProgress, Error> {
        let mut file = self.overall_progress.lock().await;
        file.read().await
    }
}
