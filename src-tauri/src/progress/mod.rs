#![allow(clippy::module_name_repetitions)]

use std::collections::{hash_map::Entry, HashMap, HashSet};

use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};

use super::course::Course;

pub mod database;

/// The raw data used to keep track of ``Course`` completion
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct CourseCompletion {
    /// The amount of time spent in the ``Course``, by day.
    pub time_spent: HashMap<NaiveDate, u64>,
    /// The raw data used to keep track of ``Textbook`` completion.
    pub books: HashMap<usize, CourseCompletionTextbook>,
}

/// The raw data used to keep track of ``Textbook`` completion
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct CourseCompletionTextbook {
    /// All completed section-ids within the textbook.
    pub completed_sections: HashSet<String>,
    /// The raw representation of the viewer's current position in the textbook.
    pub position: Option<String>,
}

impl CourseCompletion {
    fn calculate_time_diff_secs(before: &Self, after: &Self) -> i64 {
        let mut before_total = 0;
        for before_date in before.time_spent.values() {
            before_total += before_date;
        }

        let mut after_total = 0;
        for after_date in after.time_spent.values() {
            after_total += after_date;
        }

        (i128::from(after_total) - i128::from(before_total))
            .try_into()
            .unwrap_or_default()
    }
}

/// The displayed progress through a ``Course``
#[derive(Serialize, Debug)]
pub struct CourseProgress {
    /// The completion of textbooks within the course, in the order they are included in the course.
    pub completion: Vec<TextbookProgress>,
    /// The amount of time spent on this course today.
    pub time_spent_today: i64,
}

/// The displayed progress through a ``Textbook``
#[derive(Serialize, Debug)]
pub struct TextbookProgress {
    /// The completion (ranging between 0 and 1) of the entire book.
    pub overall_completion: f32,
    /// The completion (ranging between 0 and 1) of each chapter within the book.
    pub chapter_completion: Vec<f32>,
}

impl CourseProgress {
    fn calculate(course: &Course, completion: &CourseCompletion) -> Self {
        let mut book_progress = Vec::with_capacity(course.books.len());

        for (book_index, book) in course.books.iter().enumerate() {
            #[allow(clippy::cast_precision_loss)]
            book_progress.push(match completion.books.get(&book_index) {
                Some(book_completion) => {
                    let mut chapter_progress = Vec::with_capacity(book.chapters.len());

                    for chapter in &book.chapters {
                        if let Some(root) = &chapter.root {
                            if book_completion.completed_sections.contains(root) {
                                chapter_progress.push(1.0);
                                continue;
                            }
                        }

                        let mut progress = 0.0;

                        let mut total = 0.0;

                        for group in &chapter.groups {
                            let weight = group.weight.unwrap_or(1.0).max(0.0);

                            let mut group_progress: usize = 0;

                            for section in &group.sections {
                                if book_completion.completed_sections.contains(section) {
                                    group_progress += 1;
                                }
                            }

                            if group_progress == group.sections.len() {
                                progress += weight;
                            } else if group_progress > 0 {
                                progress +=
                                    (group_progress as f32 / group.sections.len() as f32) * weight;
                            }

                            total += weight;
                        }

                        if progress > 0.0 {
                            chapter_progress.push(progress / total);
                        } else {
                            chapter_progress.push(0.0);
                        }
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

        let current_date = Local::now().date_naive();

        Self {
            completion: book_progress,
            time_spent_today: completion
                .time_spent
                .get(&current_date)
                .copied()
                .unwrap_or_default()
                .try_into()
                .unwrap_or(i64::MAX),
        }
    }
    fn calculate_chapter_diff(before: &Self, after: &Self) -> f32 {
        let mut before_total = 0.0;

        for book in &before.completion {
            for chapter_completion in &book.chapter_completion {
                before_total += chapter_completion;
            }
        }

        let mut after_total = 0.0;

        for book in &after.completion {
            for chapter_completion in &book.chapter_completion {
                after_total += chapter_completion;
            }
        }

        after_total - before_total
    }
}

/// The displayed total progress through all courses
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct OverallProgress {
    /// The total number of chapters completed by day
    pub chapters_completed: HashMap<NaiveDate, f32>,
    /// The total amount of time spent in any course by day
    pub time_spent: HashMap<NaiveDate, i64>,
}

impl OverallProgress {
    fn update(&mut self, chapter_change: f32, time_change_secs: i64) {
        let date = Local::now().date_naive();

        if chapter_change.is_normal() {
            match self.chapters_completed.entry(date) {
                Entry::Occupied(mut entry) => {
                    entry.insert((entry.get() + chapter_change).max(0.0));
                }
                Entry::Vacant(entry) => {
                    if chapter_change.is_sign_positive() {
                        entry.insert(chapter_change);
                    }
                }
            }
        }

        match self.time_spent.entry(date) {
            Entry::Occupied(mut entry) => {
                entry.insert((entry.get() + time_change_secs).max(0));
            }
            Entry::Vacant(entry) => {
                if time_change_secs.is_positive() {
                    entry.insert(time_change_secs);
                }
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Settings {
    show_course_clock: bool,
    maximum_course_time: u16,
    maximum_daily_time: u16,
    maximum_daily_chapters: f32,
    weeks_displayed: u8,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            show_course_clock: true,
            maximum_course_time: 150,
            maximum_daily_time: 300,
            maximum_daily_chapters: 1.5,
            weeks_displayed: 24,
        }
    }
}
