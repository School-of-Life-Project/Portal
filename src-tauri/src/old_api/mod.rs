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

/// A dependency tree of courses
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMap {
    /// The unique ID of the course map.
    #[serde(skip_deserializing)]
    uuid: Option<Uuid>,
    /// Title for the course map
    title: String,
    /// Optional description for the course map
    description: Option<String>,
    /// The courses which are a part of this course map.
    courses: Vec<CourseMapCourse>,
}

/// A representation of a Course within a ``CourseMap``
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMapCourse {
    /// The unique ID of the course, mapping to a ``Course`` object.
    uuid: Uuid,
    /// Label for the course when displayed as part of the course map.
    /// This generally shouldn't be set to the full course title.
    label: String,
    /// The accent color of the course, defaulting to black if not specified.
    /// This can be useful to visually differentiate courses by subject.
    color: Option<String>,

    /// The courses which have a dependency relation to this course.
    ///
    /// Relations are always unidirectional, with the source being the ``CourseMapRelation`` and the destination being the ``CourseMapCourse``.
    #[serde(default)]
    relations: Vec<CourseMapRelation>,
}

/// A representation of a Course's dependency relation.
#[derive(Serialize, Deserialize, Debug)]
pub struct CourseMapRelation {
    /// The unique ID of the course, mapping to a ``CourseMapCourse`` object.
    uuid: Uuid,

    /// The type of the relation.
    /// Relations are always unidirectional, with the source being the ``CourseMapRelation`` and the destination being the ``CourseMapCourse``.
    r#type: CourseMapRelationType,

    /// Optional courses should be used to specify material which, while not necessary to complete the course itself, gives you a deeper understanding of the material than the required courses alone.
    /// Do not use optional courses to list courses which are required to understand the material, or courses which would be better specified as required corequisites (such as courses which are necessary to understand future material).
    #[serde(default)]
    optional: bool,
}

/// The type of a ``CourseMapRelation``.
#[derive(Serialize, Deserialize, Debug)]
pub enum CourseMapRelationType {
    /// Prerequisites are courses which should be taken before the following course.
    Prerequisite,
    /// Corequisites are courses which should be taken either with a course or before it.
    Corequisite,
}

impl CourseMap {
    /// Creates a visual representation of a ``CourseMap`` as an SVG.
    fn graph(&self) -> String {
        const SIZE: f64 = 128.0;
        const PADDING: f64 = 16.0;
        const LINE_WIDTH: usize = 2;
        const FONT_SIZE: usize = 16;

        let mut graph = VisualGraph::new(Orientation::TopToBottom);

        let mut nodes = HashMap::with_capacity(self.courses.len());

        let mut colors = HashMap::with_capacity(self.courses.len());

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
            let mut style = style.clone();

            if let Some(colorstring) = &course.color {
                if let Some(color) = Color::from_name(&colorstring.to_ascii_lowercase()) {
                    style.line_color = color;

                    colors.insert(course.uuid, color);
                }
            }

            let node = Element {
                shape: ShapeKind::Box(course.label.clone()),
                look: style,
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
                for relation in &course.relations {
                    if let Some(source) = nodes.get(&relation.uuid) {
                        let mut style = style.clone();

                        if let Some(color) = colors.get(&relation.uuid) {
                            style.line_color = *color;
                        }

                        let end = match relation.r#type {
                            CourseMapRelationType::Prerequisite => LineEndKind::Arrow,
                            CourseMapRelationType::Corequisite => LineEndKind::None,
                        };

                        let line_style = if relation.optional {
                            LineStyleKind::Dashed
                        } else {
                            LineStyleKind::Normal
                        };

                        graph.add_edge(
                            Arrow {
                                start: LineEndKind::None,
                                end,
                                line_style,
                                text: " ".to_string(),
                                look: style,
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
    /// The path of the textbook's corresponding ePub file, relative to the course's root directory.
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
    /// The section-id (ePub href) corresponding to the chapter's root.
    ///
    /// If this is ommitted, the completion status of the entire chapter will not be displayed within the book reader.
    root: Option<String>,

    /// A group of completable ``Section`` items within the chapter.
    #[serde(default)]
    groups: Vec<SectionGroup>,
}

/// A group of completable ``Section`` elements within a Chapter.
///
/// Grouping sections allows the weight of their completion to be intentionally weighted unevenly throughout the chapter.
#[derive(Serialize, Deserialize, Debug)]
struct SectionGroup {
    /// The relative weight multiplier of the ``SectionGroup``, defaults to 1.0.
    weight: Option<f32>,
    /// The ``Section``s included in the section group, each corresponding to a section-id (ePub href).
    ///
    /// Sections should only be included when a section's completion is meaningful to progress within the overall course.
    sections: Vec<String>,
}

/// The raw data used to keep track of ``Course`` completion
#[serde_as]
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct CourseCompletion {
    /// The amount of time spent in the ``Course``, by day.
    time_spent: HashMap<NaiveDate, u64>,
    /// The raw data used to keep track of ``Textbook`` completion.
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    books: HashMap<usize, CourseCompletionTextbook>,
}

/// The raw data used to keep track of ``Textbook`` completion
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct CourseCompletionTextbook {
    /// All completed section-ids within the textbook.
    completed_sections: HashSet<String>,
    /// The raw representation of the viewer's current position in the textbook.
    position: Option<String>,
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
