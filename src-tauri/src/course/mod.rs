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

/// A dependency tree of Courses. Must be a valid TOML file
///
/// The Course Map's filename must be a UUID in lowercase hexadecimal form without separator characters, with the `.toml`` file extension.
///
/// Note: If the Course Map fails to render, it may crash the rendering task. If this happens, try removing excessive relations or disabling layout optimization.
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct CourseMap {
    #[serde(skip_deserializing)]
    #[schemars(skip)]
    pub uuid: Uuid,
    /// Title for the Course Map
    pub title: String,
    /// Optional description for the Course Map
    pub description: Option<String>,
    /// Optimize the CourseMap's layout for visual clarity
    #[serde(default = "default_optimize")]
    pub optimize: bool,
    /// The Courses which are a part of this Course Map
    pub courses: Vec<CourseMapCourse>,
}

/// A representation of a Course within a Course Map
///
/// Courses can be specified in any order, and are added to the Course Map in the specified order
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct CourseMapCourse {
    /// The unique identifier for the Course
    pub uuid: Uuid,
    /// A short title for the Course
    pub label: String,
    /// The accent color of the Course, either specified in RGB hexadecimal format or as a CSS color keyword
    ///
    /// This can be useful to visually differentiate courses by subject
    #[serde(default = "default_color")]
    pub color: String,
    /// A list of unidirectional dependency relations for this course
    ///
    /// Relations are added to the Course Map after all Courses are added, in the order that they are specified
    #[serde(default)]
    pub relations: Vec<CourseMapRelation>,
}

/// A representation of a Course's dependency relation
///
/// Relations are always unidirectional: CourseMapRelation (source) -> CourseMapCourse (destination)
///
/// Note: It takes some trial and error to get a Course Map to display relations cleanly. Try rearranging Courses and/or Course relations, toggling layout optimization, and using Layout relations as necessary.
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
#[derive(Serialize, Deserialize, JsonSchema, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum CourseMapRelationType {
    /// Prerequisites are Courses which should be taken before the following Course
    Prerequisite,
    /// Corequisites are Courses which should be taken before *or* at the same time as the following Course
    Corequisite,
    /// Layout relations change the Course hierarchy *without* being displayed visually
    Layout,
}

/// A Course bundle index. Must be a valid TOML file
///
/// Courses are distributed as a folder containing a course.toml at the root. The Course folder's filename must be a UUID in lowercase hexadecimal form without separator characters.
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Course {
    #[schemars(skip)]
    pub uuid: Option<Uuid>,
    /// Title for the Course
    pub title: String,
    /// Optional description for the Course
    pub description: Option<String>,
    /// The textbooks which are a part of this Course
    pub books: Vec<Textbook>,
}

impl Course {
    fn make_paths_relative(&mut self) {
        for book in &mut self.books {
            book.file = into_relative_path(&book.file);
        }
    }
}

/// A textbook within a Course
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Textbook {
    /// A short title for the textbook
    pub label: String,
    /// The path of the textbook's corresponding document, relative to the Course index
    ///
    /// Must resolve to an unpacked EPUB (the EPUB container must be a folder, not a file). EPUB versions 2 - 3.2 are supported
    pub file: PathBuf,
    /// A list of user-completable chapters within the textbook
    #[serde(default)]
    pub chapters: Vec<Chapter>,
}

/// A user-completable chapter within a textbook
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct Chapter {
    /// The href from the textbook's Table of Contents corresponding to the chapter's root
    pub root: Option<String>,

    /// A list of section groups within the chapter
    #[serde(default)]
    pub groups: Vec<SectionGroup>,
}

/// A group of user-completable sections within a textbook chapter, used to calculate chapter progress
///
/// Chapter progress is calculated as:
/// sum(sectionGroup[i].completion * sectionGroup[i].weight) / sum(sectionGroup[i].weight)
///
/// Section group completion is calculated as:
/// sectionGroup.completedSections.length / sectionGroup.sections.length
#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct SectionGroup {
    /// The relative weight of the group's completion
    #[serde(default = "default_weight")]
    pub weight: f32,
    /// The user-completable sections included in the section group. Each item must be an href from the textbook's Table of Contents
    pub sections: Vec<String>,
}

fn default_optimize() -> bool {
    true
}

fn default_color() -> String {
    "black".to_string()
}

fn default_weight() -> f32 {
    1.0
}
