use std::{
    collections::{hash_map::Entry, HashMap, HashSet},
    ffi::OsString,
    path::PathBuf,
    time::Duration,
};

use chrono::{NaiveDate, Utc};
use futures::{future::join_all, try_join};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;
use wrapper::ErrorWrapper;

pub mod wrapper;

use crate::data::{self, ConfigFile, DataManager, Error, ResourceManager, WritableConfigFile};

struct State {
    data_dir: PathBuf,
    course_maps: DataManager,
    courses: ResourceManager,
    completion: DataManager,
    active_courses: Mutex<WritableConfigFile>,
    overall_progress: Mutex<WritableConfigFile>,
    settings: Mutex<WritableConfigFile>,
}

// TODO:
// - Better separate modules to take advantage of visibility
// - Find opportunities to improve concurrency
// - Find deadlock opportunities
// - Find opportunities to improve overall performance
// - Write unit tests
// - Start working on frontend API bindings

const MAX_FS_CONCURRENCY: usize = 8;

impl State {
    async fn new() -> Result<Self, Error> {
        let data_dir = data::get_data_dir(crate::IDENTIFIER).await?;

        let extension = Some(OsString::from("toml"));
        let course_map_path = data_dir.join("Course Maps");
        let course_path = data_dir.join("Courses");
        let completion_path = data_dir.join("Progress Data");
        let active_courses_path = data_dir.join("Active Courses.toml");
        let overall_progress_path = completion_path.join("total.toml");
        let settings_path = data_dir.join("Settings.toml");

        let (course_maps, courses, completion, active_courses, overall_progress, settings) = try_join!(
            DataManager::new(course_map_path, extension.clone()),
            ResourceManager::new(course_path),
            DataManager::new(completion_path, extension),
            WritableConfigFile::new(&active_courses_path),
            WritableConfigFile::new(&overall_progress_path),
            WritableConfigFile::new(&settings_path),
        )?;

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
    async fn _get_course_index(&self, id: Uuid) -> Result<Course, Error> {
        let root = self.courses.get(id).await?;

        let mut index = ConfigFile::new(&root.join("course.toml")).await?;

        let mut course = index.read::<Course>().await?;

        course.uuid = Some(id);

        for book in &mut course.books {
            book.file = data::into_relative_path(&root, &book.file);
        }

        Ok(course)
    }
    async fn _get_course_completion(&self, id: Uuid) -> Result<CourseCompletion, Error> {
        if !self.completion.has(id).await {
            return Ok(CourseCompletion::default());
        }

        let path = self.completion.get(id);
        let mut file = ConfigFile::new(&path).await?;

        file.read().await
    }
    async fn get_course(&self, id: Uuid) -> Result<(Course, CourseCompletion), Error> {
        try_join!(self._get_course_index(id), self._get_course_completion(id))
    }
    async fn get_courses(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, Error> {
        let course_list = self.courses.scan().await?;
        self._get_courses(course_list).await
    }
    async fn get_courses_active(
        &self,
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, Error> {
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
    ) -> Result<Vec<Result<(Course, CourseProgress), ErrorWrapper>>, Error> {
        let course_list: Vec<_> = course_list.into_iter().collect();

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
    async fn get_course_maps(&self) -> Result<Vec<Result<CourseMap, ErrorWrapper>>, Error> {
        let course_map_list = self.course_maps.scan().await?;
        let course_map_list: Vec<_> = course_map_list.into_iter().collect();

        let mut course_maps = Vec::with_capacity(course_map_list.len());

        for course_map_chunk in course_map_list.chunks(MAX_FS_CONCURRENCY) {
            let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY);

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
    async fn _get_course_map(&self, id: Uuid) -> Result<CourseMap, Error> {
        let path = self.course_maps.get(id);

        let mut file = ConfigFile::new(&path).await?;
        let mut map: CourseMap = file.read().await?;

        map.uuid = Some(id);

        Ok(map)
    }
    async fn set_course_active_status(&self, id: Uuid, data: bool) -> Result<(), Error> {
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
    async fn _set_course_completion(
        &self,
        id: Uuid,
        data: &CourseCompletion,
    ) -> Result<CourseCompletion, Error> {
        let completion_path = self.completion.get(id);

        let mut file = WritableConfigFile::new(&completion_path).await?;
        let old = file.read().await?;
        file.write(&data).await?;

        Ok(old)
    }
    async fn set_course_completion(&self, id: Uuid, data: CourseCompletion) -> Result<(), Error> {
        let (course, old_completion) = try_join!(
            self._get_course_index(id),
            self._set_course_completion(id, &data)
        )?;

        let old_progress = CourseProgress::calculate(&course, &old_completion);
        let new_progress = CourseProgress::calculate(&course, &data);

        let time_change_secs = CourseCompletion::calculate_time_diff_secs(&old_completion, &data);
        let chapter_change = CourseProgress::calculate_chapter_diff(&old_progress, &new_progress);

        let mut total_progress_file = self.overall_progress.lock().await;

        let mut total_progress: OverallProgress = total_progress_file.read().await?;
        total_progress.update(chapter_change, time_change_secs);
        total_progress_file.write(&total_progress).await
    }
    async fn get_settings(&self) -> Result<Settings, Error> {
        let mut file = self.settings.lock().await;

        if file.is_empty().await? {
            Ok(Settings::default())
        } else {
            file.read().await
        }
    }
    async fn set_settings(&self, data: Settings) -> Result<(), Error> {
        let mut file = self.settings.lock().await;
        file.write(&data).await
    }
    async fn get_overall_progress(&self) -> Result<OverallProgress, Error> {
        let mut file = self.overall_progress.lock().await;

        if file.is_empty().await? {
            Ok(OverallProgress::default())
        } else {
            file.read().await
        }
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

/// A Textbook within a ``Course``
#[derive(Serialize, Deserialize, Debug)]
struct Textbook {
    /// Label for the textbook when displayed as part of a larger course.
    /// This generally shouldn't be set to the full textbook title.
    label: String,
    /// The path of the textbook's corresponding ePub/PDF file, relative to the course's root directory.
    file: PathBuf,
    /// A list of *completable* ``Chapter`` items within the textbook.
    chapters: Vec<Chapter>,
}

/// A completable Chapter within a ``Textbook``
///
/// ``Chapter`` elements should only be included when a chapter's completion is meaningful to progress within the overall course.
#[derive(Serialize, Deserialize, Debug)]
struct Chapter {
    /// The section-id corresponding to the chapter's root.
    ///
    /// If this is ommitted, the completion status of the entire chapter will not be displayed within the book reader.
    root: Option<String>,
    /// A completable ``Section`` within a chapter, corresponding to a book section-id.
    ///
    /// Sections should only be included when a section's completion is meaningful to progress within the overall course.
    sections: Vec<Vec<String>>,
}

impl Course {
    /// Get a list of all files included in a ``Course``
    fn get_resources(&self) -> Vec<&PathBuf> {
        let mut files = Vec::with_capacity(self.books.len());

        for book in &self.books {
            files.push(&book.file);
        }

        files
    }
}

/// The raw data used to keep track of ``Course`` completion
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct CourseCompletion {
    /// If the course has a manually marked completion status
    completed: Option<bool>,
    /// A list of all completed section-ids within each textbook within the course.
    book_sections: HashMap<usize, HashSet<String>>,
    /// The total amount of time spent in this course, in seconds.
    time_spent_secs: f32,
}

impl CourseCompletion {
    fn calculate_time_diff_secs(before: &Self, after: &Self) -> f32 {
        after.time_spent_secs - before.time_spent_secs
    }
}

/// The displayed progress through a ``Course``
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseProgress {
    /// If a course should be considered completed
    completed: bool,
    /// The completion of textbooks within the course, in the order they are included in the course.
    completion: Vec<TextbookProgress>,
}

/// The displayed progress through a ``Textbook``
#[derive(Serialize, Deserialize, Debug)]
pub struct TextbookProgress {
    /// The completion (ranging between 0 and 1) of the entire book.
    overall_completion: f32,
    /// The completion (ranging between 0 and 1) of each chapter within the book.
    chapter_completion: Vec<f32>,
}

impl CourseProgress {
    fn calculate(course: &Course, completion: &CourseCompletion) -> Self {
        let mut book_progress = Vec::with_capacity(course.books.len());

        for (book_index, book) in course.books.iter().enumerate() {
            #[allow(clippy::cast_precision_loss)]
            book_progress.push(match completion.book_sections.get(&book_index) {
                Some(book_completion) => {
                    let mut chapter_progress = Vec::with_capacity(book.chapters.len());

                    for chapter in &book.chapters {
                        if let Some(root) = &chapter.root {
                            if book_completion.contains(root) {
                                chapter_progress.push(1.0);
                                continue;
                            }
                        }

                        let mut progress = 0.0;

                        for section_group in &chapter.sections {
                            let mut group_progress: usize = 0;

                            for section in section_group {
                                if book_completion.contains(section) {
                                    group_progress += 1;
                                }
                            }

                            if group_progress > 0 {
                                progress += group_progress as f32 / section_group.len() as f32;
                            }
                        }

                        chapter_progress.push(progress / chapter.sections.len() as f32);
                    }

                    let mut total_progress = 0.0;

                    for chapter in &chapter_progress {
                        total_progress += chapter;
                    }

                    total_progress /= chapter_progress.len() as f32;

                    TextbookProgress {
                        overall_completion: total_progress,
                        chapter_completion: chapter_progress,
                    }
                }
                None => TextbookProgress {
                    overall_completion: 0.0,
                    chapter_completion: Vec::new(),
                },
            });
        }

        let completed = match completion.completed {
            Some(c) => c,
            None => {
                if book_progress.is_empty() {
                    false
                } else {
                    let mut is_completed = true;

                    for book in &book_progress {
                        if 1.0 > book.overall_completion {
                            is_completed = false;
                        }
                    }

                    is_completed
                }
            }
        };

        Self {
            completed,
            completion: book_progress,
        }
    }
    fn calculate_chapter_diff(before: &Self, after: &Self) -> f32 {
        let mut before_total = 0.0;

        for book in &before.completion {
            before_total += book.overall_completion;
        }

        let mut after_total = 0.0;

        for book in &after.completion {
            after_total += book.overall_completion;
        }

        after_total - before_total
    }
}

/// The displayed total progress through all courses
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct OverallProgress {
    /// The total number of chapters completed by day
    chapters_completed: HashMap<NaiveDate, f32>,
    /// The total amount of time spent in any course by day
    time_spent: HashMap<NaiveDate, Duration>,
}

impl OverallProgress {
    fn update(&mut self, chapter_change: f32, time_change_secs: f32) {
        let date = Utc::now().date_naive();

        if chapter_change.is_normal() {
            match self.chapters_completed.entry(date) {
                Entry::Occupied(mut entry) => {
                    entry.insert((entry.get() - chapter_change).max(0.0));
                }
                Entry::Vacant(entry) => {
                    if chapter_change.is_sign_positive() {
                        entry.insert(chapter_change);
                    }
                }
            }
        }

        if time_change_secs.is_normal() {
            match self.time_spent.entry(date) {
                Entry::Occupied(mut entry) => {
                    let time_secs = (entry.get().as_secs_f32() - time_change_secs).max(0.0);
                    entry.insert(Duration::from_secs_f32(time_secs));
                }
                Entry::Vacant(entry) => {
                    if time_change_secs.is_sign_positive() {
                        entry.insert(Duration::from_secs_f32(time_change_secs));
                    }
                }
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Settings {}
