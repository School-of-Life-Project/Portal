use std::{collections::HashSet, ffi::OsString, path::PathBuf};

use futures::{future::join_all, try_join};
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{
    wrapper::ErrorWrapper, Course, CourseCompletion, CourseMap, CourseProgress, OverallProgress,
    Settings,
};

use crate::data::{self, ConfigFile, DataManager, Error, ResourceManager, WritableConfigFile};

pub(super) struct State {
    pub(super) data_dir: PathBuf,
    course_maps: DataManager,
    courses: ResourceManager,
    completion: DataManager,
    active_courses: Mutex<WritableConfigFile>,
    overall_progress: Mutex<WritableConfigFile>,
    settings: Mutex<WritableConfigFile>,
}

const MAX_FS_CONCURRENCY: usize = 8;

impl State {
    pub(super) async fn new() -> Result<Self, Error> {
        let data_dir = data::get_data_dir(crate::IDENTIFIER)?;

        let extension = Some(OsString::from("toml"));
        let course_map_path = data_dir.join("Course Maps");
        let course_path = data_dir.join("Courses");
        let completion_path = data_dir.join("Progress Data");
        let active_courses_path = data_dir.join("Active Courses.toml");
        let overall_progress_path = completion_path.join("total.toml");
        let settings_path = data_dir.join("Settings.toml");

        let (course_maps, courses, completion, active_courses, settings) = try_join!(
            DataManager::new(course_map_path, extension.clone()),
            ResourceManager::new(course_path),
            DataManager::new(completion_path, extension),
            WritableConfigFile::new(active_courses_path),
            WritableConfigFile::new(settings_path),
        )?;
        let overall_progress = WritableConfigFile::new(overall_progress_path).await?;

        Ok(Self {
            data_dir,
            course_maps,
            courses,
            completion,
            active_courses: Mutex::new(active_courses),
            overall_progress: Mutex::new(overall_progress),
            settings: Mutex::new(settings),
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

        for course_chunk in course_list.chunks(MAX_FS_CONCURRENCY / 2) {
            let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY / 2);

            for course in course_chunk {
                future_set.push(self.get_course(*course));
            }

            let results = join_all(future_set).await;

            for (index, result) in results.into_iter().enumerate() {
                courses.push(match result {
                    Ok((course, completion)) => {
                        let progress = CourseProgress::calculate(&course, &completion);
                        Ok((course, progress))
                    }
                    Err(err) => Err(ErrorWrapper::new(
                        format!("Unable to get Course {}", course_chunk[index]),
                        &err,
                    )),
                });
            }
        }

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

        let mut file = ConfigFile::new(path).await?;
        let mut map: CourseMap = file.read().await?;
        map.update_id(id);

        Ok(map)
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
        data: &CourseCompletion,
    ) -> Result<(), Error> {
        let (course, old_completion) = try_join!(self.get_course_index(id), async {
            let completion_path = self.completion.get(id);

            let mut file = WritableConfigFile::new(completion_path).await?;
            let old = file.read().await?;
            file.write(data).await?;

            Ok(old)
        })?;

        let old_progress = CourseProgress::calculate(&course, &old_completion);
        let new_progress = CourseProgress::calculate(&course, data);

        let time_change_secs = CourseCompletion::calculate_time_diff_secs(&old_completion, data);
        let chapter_change = CourseProgress::calculate_chapter_diff(&old_progress, &new_progress);

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
