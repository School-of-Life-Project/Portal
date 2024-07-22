use std::{
    collections::HashMap,
    path::{Component, Path, PathBuf},
};

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
use uuid::Uuid;

mod storage;

pub fn into_relative_path(path: &Path) -> PathBuf {
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
    pub fn generate_svg(&self) -> String {
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
    pub fn make_paths_relative(&mut self) {
        for book in &mut self.books {
            book.file = into_relative_path(&book.file);
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
