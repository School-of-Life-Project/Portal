#![allow(clippy::module_name_repetitions)]
#![allow(clippy::doc_markdown)] // Documentation comments are primarily used for JsonSchema

use std::path::{Component, Path, PathBuf};

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod storage;
mod svg;

fn into_relative_path(path: &Path) -> PathBuf {
    let mut new = PathBuf::new();

    let mut items: usize = 0;
    let mut popped = 0;

    for component in path.components() {
        match component {
            Component::Prefix(_) | Component::RootDir | Component::CurDir => {}
            Component::ParentDir => {
                if items.saturating_sub(popped) > 0 {
                    new.pop();
                    popped += 1;
                }
            }
            Component::Normal(item) => {
                new.push(item);
                items += 1;
            }
        }
    }

    new
}

/// A dependency tree of Courses
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct CourseMap {
    #[serde(skip_deserializing)]
    pub uuid: Uuid,
    /// Title for the Course Map
    pub title: String,
    /// Optional description for the Course Map
    pub description: Option<String>,
    /// The Courses which are a part of this Course Map
    pub courses: Vec<CourseMapCourse>,
}

/// A representation of a Course within a Course Map
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct CourseMapCourse {
    /// The unique identifier for the Course
    pub uuid: Uuid,
    /// A short title for the Course
    pub label: String,
    /// The accent color of the Course, either specified in RGB hexadecimal format or as a CSS color keyword. Defaults to black if not specified.
    /// This can be useful to visually differentiate courses by subject.
    pub color: Option<String>,
    /// A list of unidirectional dependency relations for this course
    #[serde(default)]
    pub relations: Vec<CourseMapRelation>,
}

/// A representation of a Course's dependency relation
///
/// Relations are always unidirectional: CourseMapRelation (source) -> CourseMapCourse (destination)
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct CourseMapRelation {
    /// The unique identifier of the (source) Course. Must correspond to an existing CourseMapCourse object
    pub uuid: Uuid,

    /// The type of the relation
    pub r#type: CourseMapRelationType,

    /// Mark a relation as optional
    #[serde(default)]
    pub optional: bool,
}

/// Types of Course dependency relations
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub enum CourseMapRelationType {
    /// Prerequisites are Courses which should be taken before the following Course
    Prerequisite,
    /// Corequisites are Courses which should be taken before *or* at the same time as the following Course
    Corequisite,
}

/// A Course bundle index
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Course {
    #[schemars(skip_deserializing)]
    pub uuid: Option<Uuid>,
    /// Title for the course
    pub title: String,
    /// Optional description for the course
    pub description: Option<String>,
    /// The textbooks which are a part of this course
    pub books: Vec<Textbook>,
}

impl Course {
    fn make_paths_relative(&mut self) {
        for book in &mut self.books {
            book.file = into_relative_path(&book.file);
        }
    }
}

/// A Textbook within a ``Course``
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Textbook {
    /// Label for the textbook when displayed as part of a larger course.
    /// This generally shouldn't be set to the full textbook title.
    pub label: String,
    /// The path of the textbook's corresponding ePub file, relative to the course's root directory.
    pub file: PathBuf,
    /// A list of *completable* ``Chapter`` items within the textbook.
    #[serde(default)]
    pub chapters: Vec<Chapter>,
}

/// A completable Chapter within a ``Textbook``
///
/// ``Chapter`` elements should only be included when a chapter's completion is meaningful to progress within the overall course.
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Chapter {
    /// The section-id (ePub href) corresponding to the chapter's root.
    ///
    /// If this is ommitted, the completion status of the entire chapter will not be displayed within the book reader.
    pub root: Option<String>,

    /// A group of completable ``Section`` items within the chapter.
    #[serde(default)]
    pub groups: Vec<SectionGroup>,
}

/// A group of completable ``Section`` elements within a Chapter.
///
/// Grouping sections allows the weight of their completion to be intentionally weighted unevenly throughout the chapter.
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct SectionGroup {
    /// The relative weight multiplier of the ``SectionGroup``, defaults to 1.0.
    pub weight: Option<f32>,
    /// The ``Section``s included in the section group, each corresponding to a section-id (ePub href).
    ///
    /// Sections should only be included when a section's completion is meaningful to progress within the overall course.
    pub sections: Vec<String>,
}
