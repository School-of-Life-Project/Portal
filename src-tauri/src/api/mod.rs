// TODO! : Separate CourseCompletion.time_spent_secs by day

use std::{
    collections::{hash_map::Entry, HashMap, HashSet},
    path::{Path, PathBuf},
};

use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

mod state;
pub mod wrapper;

use crate::data;

// TODO
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMap {
    uuid: Option<Uuid>,
}

impl CourseMap {
    fn update_id(&mut self, id: Uuid) {
        self.uuid = Some(id);
    }
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
    #[serde(default)]
    books: Vec<Textbook>,
}

impl Course {
    fn update_root(&mut self, root: &Path, id: Uuid) {
        self.uuid = Some(id);

        for book in &mut self.books {
            book.file = data::into_relative_path(root, &book.file);
        }
    }
    fn remove_resources(&mut self) {
        for book in &mut self.books {
            book.file = PathBuf::from("hidden");
        }
    }
    /// Get a list of all files included in a ``Course``
    fn get_resources(&self) -> Vec<&PathBuf> {
        let mut files = Vec::with_capacity(self.books.len());

        for book in &self.books {
            files.push(&book.file);
        }

        files
    }
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
    #[serde(default)]
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
    #[serde(default)]
    sections: Vec<Vec<String>>,
}

/// The raw data used to keep track of ``Course`` completion
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct CourseCompletion {
    /// If the course has a manually marked completion status
    completed: Option<bool>,
    /// A list of all completed section-ids within each textbook within the course.
    book_sections: HashMap<usize, HashSet<String>>,
    /// The total amount of time spent in this course, in seconds.
    time_spent_secs: f32,
    /// The raw data used to keep track of the viewer's current position within a textbook.
    position: HashMap<usize, String>,
}

impl CourseCompletion {
    fn calculate_time_diff_secs(before: &Self, after: &Self) -> f32 {
        after.time_spent_secs - before.time_spent_secs
    }
}

/// The displayed progress through a ``Course``
#[derive(Serialize, Debug)]
pub struct CourseProgress {
    /// If a course should be considered completed
    completed: bool,
    /// The completion of textbooks within the course, in the order they are included in the course.
    completion: Vec<TextbookProgress>,
}

/// The displayed progress through a ``Textbook``
#[derive(Serialize, Debug)]
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
#[serde(default)]
pub struct OverallProgress {
    /// The total number of chapters completed by day
    chapters_completed: HashMap<NaiveDate, f32>,
    /// The total amount of time spent in any course by day
    time_spent: HashMap<NaiveDate, f32>,
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
                    entry.insert((entry.get() - time_change_secs).max(0.0));
                }
                Entry::Vacant(entry) => {
                    if time_change_secs.is_sign_positive() {
                        entry.insert(time_change_secs);
                    }
                }
            }
        }
    }
}

// TODO
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Settings {}
