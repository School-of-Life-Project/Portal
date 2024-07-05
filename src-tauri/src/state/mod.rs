use std::{ffi::OsString, path::PathBuf};

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;

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

impl State {
    async fn new() -> Result<Self, DataError> {
        let data_dir = data::get_data_dir(crate::IDENTIFIER).await?;

        let extension = Some(OsString::from("toml"));
        let course_map_path = data_dir.join("Course Maps");
        let course_path = data_dir.join("Courses");
        let progress_path = data_dir.join("Progress");
        let active_courses_path = data_dir.join("Active Courses.toml");
        let settings_path = data_dir.join("Settings.toml");

        Ok(Self {
            data_dir,
            course_maps: DataManager::new(course_map_path, extension.clone()).await?,
            courses: ResourceManager::new(course_path).await?,
            progress: DataManager::new(progress_path, extension).await?,
            active_courses: Mutex::new(WritableConfigFile::new(&active_courses_path).await?),
            settings: Mutex::new(WritableConfigFile::new(&settings_path).await?),
        })
    }
    async fn get_course_map_list(&self) -> Result<Vec<Uuid>, DataError> {
        self.course_maps.scan().await
    }
    async fn get_course_map(&self, id: Uuid) -> Result<CourseMap, DataError> {
        let path = self.course_maps.get(id);

        let mut file = ConfigFile::new(&path).await?;
        file.read().await
    }
    async fn get_course_list(&self) -> Result<Vec<Uuid>, DataError> {
        self.courses.scan().await
    }
    async fn get_course(&self, id: Uuid) -> Result<Course, DataError> {
        let root = self.courses.get(id).await?;

        let mut index = ConfigFile::new(&root.join("course.toml")).await?;
        let mut course: Course = index.read().await?;

        for book in course.books.iter_mut() {
            book.file = data::into_relative_path(&root, &book.file);
        }

        Ok(course)
    }
    async fn get_course_progress(&self, id: Uuid) -> Result<CourseProgress, DataError> {
        let path = self.progress.get(id);

        let mut file = WritableConfigFile::new(&path).await?;

        if file.is_empty().await? {
            let data = CourseProgress::default();

            file.write(&data).await?;
            Ok(data)
        } else {
            file.read().await
        }
    }
    async fn set_course_progress(&self, id: Uuid, data: CourseProgress) -> Result<(), DataError> {
        let path = self.progress.get(id);

        let mut file = WritableConfigFile::new(&path).await?;
        file.write(&data).await
    }
    async fn get_active_courses(&self) -> Result<Vec<Uuid>, DataError> {
        let mut file = self.active_courses.lock().await;

        if file.is_empty().await? {
            let data = Vec::new();

            file.write(&data).await?;
            Ok(data)
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
            let data = Settings::default();

            file.write(&data).await?;
            Ok(data)
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
pub struct CourseMap {}

#[derive(Serialize, Deserialize, Debug)]
pub struct Course {
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
pub struct CourseProgress {}

#[derive(Serialize, Deserialize, Debug)]
struct Textbook {
    label: String,
    file: PathBuf,
    chapters: Vec<Chapter>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Chapter {
    id: Option<String>,
    sections: Vec<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Settings {}
