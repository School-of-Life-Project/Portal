use std::{collections::HashSet, ffi::OsString, path::PathBuf};

use futures::{future::join_all, try_join};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;
use wrapper::ErrorWrapper;

pub mod wrapper;

use crate::data::{self, ConfigFile, DataError, DataManager, ResourceManager, WritableConfigFile};

struct State {
    data_dir: PathBuf,
    course_maps: DataManager,
    courses: ResourceManager,
    completion: DataManager,
    active_courses: Mutex<WritableConfigFile>,
    settings: Mutex<WritableConfigFile>,
}

const MAX_FS_CONCURRENCY: usize = 8;

impl State {
    async fn new() -> Result<Self, DataError> {
        let data_dir = data::get_data_dir(crate::IDENTIFIER).await?;

        let extension = Some(OsString::from("toml"));
        let course_map_path = data_dir.join("Course Maps");
        let course_path = data_dir.join("Courses");
        let completion_path = data_dir.join("Progress Data");
        let active_courses_path = data_dir.join("Active Courses.toml");
        let settings_path = data_dir.join("Settings.toml");

        let (course_maps, courses, completion, active_courses, settings) = try_join!(
            DataManager::new(course_map_path, extension.clone()),
            ResourceManager::new(course_path),
            DataManager::new(completion_path, extension),
            WritableConfigFile::new(&active_courses_path),
            WritableConfigFile::new(&settings_path),
        )?;

        Ok(Self {
            data_dir,
            course_maps,
            courses,
            completion,
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
    async fn _get_course_completion(
        &self,
        id: Uuid,
    ) -> Result<Option<CourseCompletion>, DataError> {
        if !self.completion.has(id).await {
            return Ok(None);
        }

        let path = self.completion.get(id);
        let mut file = ConfigFile::new(&path).await?;

        file.read().await.map(Some)
    }
    async fn get_course(&self, id: Uuid) -> Result<(Course, CourseCompletion), DataError> {
        let (course, completion) =
            try_join!(self._get_course_index(id), self._get_course_completion(id))?;

        let completion = completion.unwrap_or_else(|| CourseCompletion::new(&course));

        Ok((course, completion))
    }
    async fn get_courses(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, DataError> {
        let course_list = self.courses.scan().await?;
        self._get_courses(course_list).await
    }
    async fn get_courses_active(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, DataError> {
        let mut file = self.active_courses.lock().await;

        let course_list: HashSet<Uuid> = if file.is_empty().await? {
            HashSet::new()
        } else {
            file.read().await?
        };

        self._get_courses(course_list).await
    }
    async fn _get_courses(
        &self,
        course_list: HashSet<Uuid>,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, DataError> {
        let course_list: Vec<_> = course_list.into_iter().collect();

        let mut courses = Vec::new();

        for course_chunk in course_list.chunks(MAX_FS_CONCURRENCY / 2) {
            let mut future_set = Vec::new();

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
    async fn get_course_maps(&self) -> Result<Vec<Result<CourseMap, ErrorWrapper>>, DataError> {
        let course_map_list = self.course_maps.scan().await?;
        let course_map_list: Vec<_> = course_map_list.into_iter().collect();

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
    async fn set_course_active_status(&self, id: Uuid, data: bool) -> Result<(), DataError> {
        let mut file = self.active_courses.lock().await;

        let mut active_courses: HashSet<Uuid> = if file.is_empty().await? {
            HashSet::new()
        } else {
            file.read().await?
        };

        if data {
            active_courses.insert(id);
        } else {
            active_courses.remove(&id);
        }

        file.write(&active_courses).await
    }
    async fn set_course_completion(
        &self,
        id: Uuid,
        data: CourseCompletion,
    ) -> Result<(), DataError> {
        let path = self.completion.get(id);

        let mut file = WritableConfigFile::new(&path).await?;
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

// TODO
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMap {
    uuid: Option<Uuid>,
}

/// A Course bundle index
#[derive(Serialize, Deserialize, Debug)]
pub struct Course {
    /// The unique ID of the course. Do NOT include in an index file, this will be automatically overwritten by the Course's folder name.
    uuid: Option<Uuid>,
    /// Title for the course
    title: String,
    /// Optional description for the course
    description: Option<String>,
    /// The textbooks which are a part of this course.
    books: Vec<Textbook>,
}

/// A Textbook within a Course
#[derive(Serialize, Deserialize, Debug)]
struct Textbook {
    /// Label for the textbook when displayed as part of a larger course.
    /// This generally shouldn't be set to the full textbook title.
    label: String,
    /// The path of the textbook's corresponding ePub/PDF file, relative to the course's root directory.
    file: PathBuf,
    /// A list of *completable* Chapter items within the textbook.
    chapters: Vec<Chapter>,
}

/// A completable Chapter within a Textbook
///
/// Chapter elements should only be included when a chapter's completion is meaningful to progress within the overall course.
#[derive(Serialize, Deserialize, Debug)]
struct Chapter {
    /// The section-id corresponding to the Chapter's root.
    ///
    /// If this is ommitted, the completion status of the entire chapter will not be displayed within the book reader.
    root: Option<String>,
    /// A completable Section within a Chapter, corresponding to a book section-id.
    ///
    /// Sections should only be included when a section's completion is meaningful to progress within the overall course.
    sections: Vec<Vec<String>>,
}

impl Course {
    /// Get a list of all files included in a Course
    fn get_resources(&self) -> Vec<&PathBuf> {
        let mut files = Vec::new();

        for book in &self.books {
            files.push(&book.file);
        }

        files
    }
}

/// The raw data used to keep track of Course completion
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseCompletion {
    /// If the course has a manually marked completion status
    completed: Option<bool>,
    /// A list of all completed section-ids within each textbook within the course.
    books: Vec<Vec<String>>,
}

impl CourseCompletion {
    fn new(course: &Course) -> Self {
        todo!()
    }
}

/// The displayed progress through a course
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseProgress {
    /// If a course should be considered completed
    completed: bool,
    /// The completion of textbooks within the course, in the order they are included in the course. Not included if the course has been manually marked as completed.
    completion: Vec<TextbookProgress>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TextbookProgress {
    /// The completion (ranging between 0 and 1) of the entire book.
    overall_completion: f32,
    /// The completion (ranging between 0 and 1) of each chapter within the book.
    chapter_completion: Vec<f32>,
}

impl CourseProgress {
    fn calculate(course: &Course, completion: &CourseCompletion) -> Self {
        todo!()
    }
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Settings {}
