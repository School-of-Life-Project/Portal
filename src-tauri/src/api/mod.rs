use std::{
    collections::{hash_map::Entry, HashMap, HashSet},
    path::{Path, PathBuf},
};

use chrono::{Local, NaiveDate};
use layout::{
    backends::svg::SVGWriter,
    core::{
        base::Orientation,
        color::Color,
        geometry::{Point, Position},
        style::{LineStyleKind, StyleAttr},
    },
    std_shapes::shapes::{Arrow, Element, LineEndKind, ShapeKind},
    topo::layout::VisualGraph,
};
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, DisplayFromStr};
use uuid::Uuid;

mod state;
pub mod wrapper;

use crate::data;

#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMap {
    #[serde(skip_deserializing)]
    uuid: Option<Uuid>,

    title: String,
    description: Option<String>,
    courses: Vec<CourseMapCourse>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMapCourse {
    uuid: Uuid,
    label: String,
    #[serde(default)]
    group: u8,
    #[serde(default)]
    prerequisites: Vec<Uuid>,
    #[serde(default)]
    corequisites: Vec<Uuid>,
}

impl CourseMap {
    fn graph(&self) -> String {
        const SIZE: f64 = 128.0;
        const PADDING: f64 = 16.0;
        const LINE_WIDTH: usize = 2;
        const FONT_SIZE: usize = 16;

        let mut graph = VisualGraph::new(Orientation::TopToBottom);

        let mut nodes = HashMap::with_capacity(self.courses.len());

        #[allow(clippy::cast_sign_loss)]
        #[allow(clippy::cast_possible_truncation)]
        let style = StyleAttr {
            line_color: Color::from_name("black").unwrap(),
            line_width: LINE_WIDTH,
            fill_color: None,
            rounded: SIZE as usize / 16,
            font_size: FONT_SIZE,
        };

        for course in &self.courses {
            let node = Element {
                shape: ShapeKind::Box(course.label.clone()),
                look: style.clone(),
                orientation: Orientation::TopToBottom,
                pos: Position::new(
                    Point::zero(),
                    Point::new(SIZE, SIZE),
                    Point::zero(),
                    Point::splat(PADDING),
                ),
            };

            nodes.insert(course.uuid, graph.add_node(node));
        }

        for course in &self.courses {
            if let Some(dest) = nodes.get(&course.uuid) {
                for prerequisite in &course.prerequisites {
                    if let Some(source) = nodes.get(prerequisite) {
                        graph.add_edge(
                            Arrow {
                                start: LineEndKind::None,
                                end: LineEndKind::Arrow,
                                line_style: LineStyleKind::Normal,
                                //text: "prerequisite".to_string(),
                                text: " ".to_string(),
                                look: style.clone(),
                                src_port: None,
                                dst_port: None,
                            },
                            *source,
                            *dest,
                        );
                    }
                }

                for corequisite in &course.corequisites {
                    if let Some(source) = nodes.get(corequisite) {
                        graph.add_edge(
                            Arrow {
                                start: LineEndKind::None,
                                end: LineEndKind::None,
                                line_style: LineStyleKind::Normal,
                                //text: "corequisite".to_string(),
                                text: " ".to_string(),
                                look: style.clone(),
                                src_port: None,
                                dst_port: None,
                            },
                            *source,
                            *dest,
                        );
                    }
                }
            }
        }

        let mut writer = SVGWriter::new();

        graph.do_it(false, false, false, &mut writer);

        writer.finalize()
    }
}

/// A Course bundle index
#[derive(Serialize, Deserialize, Debug)]
pub struct Course {
    /// The unique ID of the course.
    #[serde(skip_deserializing)]
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
#[serde_as]
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct CourseCompletion {
    /// If the course has a manually marked completion status
    completed: Option<bool>,
    /// A list of all completed section-ids within each textbook within the course.
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    book_sections: HashMap<usize, HashSet<String>>,
    /// The total amount of time spent in this course, in seconds.
    time_spent: i64,
    /// The raw data used to keep track of the viewer's current position within a textbook.
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    position: HashMap<usize, String>,
}

impl CourseCompletion {
    fn calculate_time_diff_secs(before: &Self, after: &Self) -> i64 {
        after.time_spent - before.time_spent
    }
}

/// The displayed progress through a ``Course``
#[derive(Serialize, Debug)]
pub struct CourseProgress {
    /// If a course should be considered completed
    completed: bool,
    /// The completion of textbooks within the course, in the order they are included in the course.
    completion: Vec<TextbookProgress>,
    /// The amount of time spent on this course today.
    time_spent_today: i64,
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
    fn calculate(
        course: &Course,
        completion: &CourseCompletion,
        offsets: &mut CourseTimeOffsets,
    ) -> Self {
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

                        if progress > 0.0 {
                            chapter_progress.push(progress / chapter.sections.len() as f32);
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
            time_spent_today: completion.time_spent - offsets.today(course, completion),
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
    chapters_completed: HashMap<NaiveDate, f32>,
    /// The total amount of time spent in any course by day
    time_spent: HashMap<NaiveDate, i64>,
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

/// The per-course time offsets used to separate progress by day
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct CourseTimeOffsets {
    date: Option<NaiveDate>,
    offsets: HashMap<Uuid, i64>,
}

impl CourseTimeOffsets {
    fn today(&mut self, course: &Course, completion: &CourseCompletion) -> i64 {
        let current_date = Local::now().date_naive();

        if self.date != Some(current_date) {
            self.date = Some(current_date);
            self.offsets = HashMap::new();
        }

        match self.offsets.entry(course.uuid.unwrap()) {
            Entry::Occupied(entry) => *entry.get(),
            Entry::Vacant(entry) => {
                entry.insert(completion.time_spent);
                completion.time_spent
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
