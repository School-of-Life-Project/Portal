use std::{ffi::OsString, path::PathBuf};

use futures::{future::join_all, try_join};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::set;
use tokio::{fs, sync::Mutex};
use uuid::Uuid;
use wrapper::ErrorWrapper;

pub mod wrapper;

use crate::data::{self, ConfigFile, DataError, DataManager, ResourceManager, WritableConfigFile};

struct State {
    data_dir: PathBuf,
    course_maps: DataManager,
    courses: ResourceManager,
    progress: DataManager,
    active_courses: Mutex<WritableConfigFile>,
    settings: Mutex<WritableConfigFile>,
}

/*

App flow:

- Course viewer
    - (get) Course (+resources)
        - (get) CourseProgress
    - (set) CourseProgress
- Homepage
    - (get) ActiveCourses
    - (get) Course
        - (get) CourseProgress

- Course Map
    - (get, list) CourseMap
    - (get, list) Course
        - (get, set) CourseProgress
    - (get, set) ActiveCourses

New API outline:

    list Course
    list CourseMap

    list CourseMap
        returns []CourseMap

    get Course {id}
        returns (Course, CourseProgress)

    get ActiveCourses
        returns []Course

    set ActiveCourses []Uuid



    set CourseProgress {id}




*/

const MAX_FS_CONCURRENCY: usize = 6;

impl State {
    async fn new() -> Result<Self, DataError> {
        let data_dir = data::get_data_dir(crate::IDENTIFIER).await?;

        let extension = Some(OsString::from("toml"));
        let course_map_path = data_dir.join("Course Maps");
        let course_path = data_dir.join("Courses");
        let progress_path = data_dir.join("Progress Data");
        let active_courses_path = data_dir.join("Active Courses.toml");
        let settings_path = data_dir.join("Settings.toml");

        let (course_maps, courses, progress, active_courses, settings) = try_join!(
            DataManager::new(course_map_path, extension.clone()),
            ResourceManager::new(course_path),
            DataManager::new(progress_path, extension),
            WritableConfigFile::new(&active_courses_path),
            WritableConfigFile::new(&settings_path),
        )?;

        Ok(Self {
            data_dir,
            course_maps,
            courses,
            progress,
            active_courses: Mutex::new(active_courses),
            settings: Mutex::new(settings),
        })
    }
    async fn get_course(&self, id: Uuid) -> Result<(Course, CourseProgress), DataError> {
        let course_root = self.courses.get(id).await?;
        let course_index_path = course_root.join("course.toml");
        let course_progress_path = self.progress.get(id);

        let (mut course, course_progress) = if self.progress.has(id).await {
            let (mut index, mut progress) = try_join!(
                ConfigFile::new(&course_index_path),
                ConfigFile::new(&course_progress_path)
            )?;

            try_join!(index.read::<Course>(), progress.read())?
        } else {
            let mut index = ConfigFile::new(&course_index_path).await?;

            (index.read().await?, CourseProgress::default())
        };

        course.uuid = Some(id);

        for book in course.books.iter_mut() {
            book.file = data::into_relative_path(&course_root, &book.file);
        }

        Ok((course, course_progress))
    }
    async fn update_course_progress(
        &self,
        id: Uuid,
        data: CourseProgress,
    ) -> Result<(), DataError> {
        let path = self.progress.get(id);

        let mut file = WritableConfigFile::new(&path).await?;
        file.write(&data).await
    }
    async fn get_course_maps(&self) -> Result<Vec<Result<CourseMap, ErrorWrapper>>, DataError> {
        let course_map_list = self.course_maps.scan().await?;

        let mut course_maps = Vec::new();
        let mut uuids = Vec::new();

        for course_map_set in course_map_list.chunks(MAX_FS_CONCURRENCY) {
            let mut future_set = Vec::new();

            for course_map in course_map_set {
                uuids.push(course_map);
                future_set.push(self._get_course_map(*course_map));
            }

            let mut results = join_all(future_set).await;
            course_maps.append(&mut results);
        }

        let mut combined_course_maps = Vec::new();

        for (index, course_map) in course_maps.into_iter().enumerate() {
            match course_map {
                Ok(mut map) => {
                    map.uuid = Some(*uuids[index]);
                    combined_course_maps.push(Ok(map))
                }
                Err(err) => combined_course_maps.push(Err(ErrorWrapper::new(
                    format!("Unable to get CourseMap {}", uuids[index]),
                    &err,
                ))),
            }
        }

        Ok(combined_course_maps)
    }
    async fn _get_course_map(&self, id: Uuid) -> Result<CourseMap, DataError> {
        let path = self.course_maps.get(id);

        let mut file = ConfigFile::new(&path).await?;
        let mut map: CourseMap = file.read().await?;

        map.uuid = Some(id);

        Ok(map)
    }

    async fn get_course_list(&self) -> Result<Vec<Uuid>, DataError> {
        self.courses.scan().await
    }

    async fn get_active_courses(&self) -> Result<Vec<Uuid>, DataError> {
        let mut file = self.active_courses.lock().await;

        if file.is_empty().await? {
            Ok(Vec::new())
        } else {
            file.read().await
        }
    }
    async fn set_active_courses(&self, data: Vec<Uuid>) -> Result<(), DataError> {
        let mut file = self.active_courses.lock().await;
        file.write(&data).await
    }
    async fn get_settings(&self) -> Result<Settings, DataError> {
        let mut file = self.settings.lock().await;

        if file.is_empty().await? {
            Ok(Settings::default())
        } else {
            file.read().await
        }
    }
    async fn set_settings(&self, data: Settings) -> Result<(), DataError> {
        let mut file = self.settings.lock().await;
        file.write(&data).await
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMap {
    uuid: Option<Uuid>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Course {
    uuid: Option<Uuid>,
    title: String,
    description: Option<String>,
    books: Vec<Textbook>,
}

impl Course {
    fn get_resources(&self) -> Vec<&PathBuf> {
        let mut files = Vec::new();

        for book in &self.books {
            files.push(&book.file);
        }

        files
    }
}

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct CourseProgress {
    completed_book_sections: Vec<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Textbook {
    label: String,
    file: PathBuf,
    chapters: Vec<Chapter>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Chapter {
    root: Option<String>,
    sections: Vec<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Settings {}
