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
    list CourseMap
        returns []CourseMap

    list Course
        returns [](Course, CourseProgress)
    get Course {id}
        returns (Course, CourseProgres)

    set Course active {bool}
    set Course section_completed {book_index} {section_id} {bool}
    set Course completed {bool}

    list ActiveCourse
        returns [](Course, CourseProgress)

    get Settings
    set Settings {Settings}

*/

const MAX_FS_CONCURRENCY: usize = 8;

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
    async fn _get_course_index(&self, id: Uuid) -> Result<Course, DataError> {
        let root = self.courses.get(id).await?;

        let mut index = ConfigFile::new(&root.join("course.toml")).await?;

        let mut course = index.read::<Course>().await?;

        course.uuid = Some(id);

        for book in course.books.iter_mut() {
            book.file = data::into_relative_path(&root, &book.file);
        }

        Ok(course)
    }
    async fn _get_course_progress(&self, id: Uuid) -> Result<CourseProgress, DataError> {
        if !self.progress.has(id).await {
            return Ok(CourseProgress::default());
        }

        let path = self.progress.get(id);
        let mut file = ConfigFile::new(&path).await?;

        file.read().await
    }
    async fn get_course(&self, id: Uuid) -> Result<(Course, CourseProgress), DataError> {
        try_join!(self._get_course_index(id), self._get_course_progress(id))
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
    async fn get_courses(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, DataError> {
        let course_list = self.courses.scan().await?;

        let mut courses = Vec::new();

        for course_chunk in course_list.chunks(MAX_FS_CONCURRENCY / 2) {
            let mut future_set = Vec::new();

            for course in course_chunk {
                future_set.push(self.get_course(*course));
            }

            let results = join_all(future_set).await;

            for (index, result) in results.into_iter().enumerate() {
                courses.push(result.map_err(|err| {
                    ErrorWrapper::new(
                        format!("Unable to get Course {}", course_chunk[index]),
                        &err,
                    )
                }));
            }
        }

        Ok(courses)
    }
    async fn get_course_maps(&self) -> Result<Vec<Result<CourseMap, ErrorWrapper>>, DataError> {
        let course_map_list = self.course_maps.scan().await?;

        let mut course_maps = Vec::new();

        for course_map_chunk in course_map_list.chunks(MAX_FS_CONCURRENCY) {
            let mut future_set = Vec::new();

            for course_map in course_map_chunk {
                future_set.push(self._get_course_map(*course_map));
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
    async fn _get_course_map(&self, id: Uuid) -> Result<CourseMap, DataError> {
        let path = self.course_maps.get(id);

        let mut file = ConfigFile::new(&path).await?;
        let mut map: CourseMap = file.read().await?;

        map.uuid = Some(id);

        Ok(map)
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
