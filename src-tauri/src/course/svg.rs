#![allow(clippy::cast_precision_loss)]

use std::collections::HashMap;

use layout::{
    core::{
        base::Orientation,
        color::Color,
        format::{ClipHandle, RenderBackend},
        geometry::{Point, Position},
        style::{LineStyleKind, StyleAttr},
    },
    std_shapes::shapes::{Arrow, Element, LineEndKind, ShapeKind},
    topo::layout::VisualGraph,
};
use serde_json::{from_str, to_string};

use super::{CourseMap, CourseMapCourse, CourseMapRelationType};

pub(super) const SIZE: f64 = 128.0;
pub(super) const RATIO: f64 = 1.2;
pub(super) const PADDING: f64 = 14.0;
pub(super) const LINE_WIDTH: usize = 2;

impl CourseMap {
    /// Creates a visual representation of a ``CourseMap`` as an SVG.
    pub fn generate_svg(&self) -> String {
        let mut graph = self.generate_graph();

        let mut writer = SVGWriter::new();

        graph.do_it(false, false, false, &mut writer);

        writer.finalize()
    }
    fn generate_graph(&self) -> VisualGraph {
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
            font_size: 8,
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
                shape: ShapeKind::Box(to_string(course).unwrap()),
                look: style,
                orientation: Orientation::TopToBottom,
                pos: Position::new(
                    Point::zero(),
                    Point::new(SIZE * RATIO, SIZE / RATIO),
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

        graph
    }
}

// Below code is based heavily on layout-rs' SVGWriter

static SVG_DEFS: &str = r#"<defs>
<marker id="startarrow" markerWidth="10" markerHeight="7"
refX="0" refY="3.5" orient="auto">
<polygon points="10 0, 10 7, 0 3.5" />
</marker>
<marker id="endarrow" markerWidth="10" markerHeight="7"
refX="10" refY="3.5" orient="auto">
<polygon points="0 0, 10 3.5, 0 7" />
</marker>

</defs>"#;

static SVG_FOOTER: &str = "</svg>";

fn escape_string(x: &str) -> String {
    let mut res = String::new();
    for c in x.chars() {
        match c {
            '&' => {
                res.push_str("&amp;");
            }
            '<' => {
                res.push_str("&lt;");
            }
            '>' => {
                res.push_str("&gt;");
            }
            '"' => {
                res.push_str("&quot;");
            }
            '\'' => {
                res.push_str("&apos;");
            }
            _ => {
                res.push(c);
            }
        }
    }
    res
}

pub struct SVGWriter {
    content: String,
    view_size: Point,
    counter: usize,
    // A list of clip regions to generate.
    clip_regions: Vec<String>,
}

impl SVGWriter {
    pub fn new() -> SVGWriter {
        SVGWriter {
            content: String::new(),
            view_size: Point::zero(),
            counter: 0,
            clip_regions: Vec::new(),
        }
    }
}

impl SVGWriter {
    // Grow the viewable svg window to include the point \p point plus some
    // offset \p size.
    fn grow_window(&mut self, point: Point, size: Point) {
        self.view_size.x = self.view_size.x.max(point.x + size.x + 5.);
        self.view_size.y = self.view_size.y.max(point.y + size.y + 5.);
    }

    pub fn finalize(&self) -> String {
        let mut result = String::new();

        let svg_line = format!(
            "<svg width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\
            \" xmlns=\"http://www.w3.org/2000/svg\">\n",
            self.view_size.x, self.view_size.y, self.view_size.x, self.view_size.y
        );
        result.push_str(&svg_line);
        result.push_str(SVG_DEFS);
        result.push_str(&self.content);
        result.push_str(SVG_FOOTER);
        result
    }
}
impl RenderBackend for SVGWriter {
    fn draw_rect(&mut self, xy: Point, size: Point, look: &StyleAttr, clip: Option<ClipHandle>) {
        self.grow_window(xy, size);

        let mut clip_option = String::new();
        if let Option::Some(clip_id) = clip {
            clip_option = format!("clip-path=\"url(#C{clip_id})\"");
        }

        let fill_color = look.fill_color.unwrap_or_else(Color::transparent);
        let stroke_width = look.line_width;
        let stroke_color = look.line_color;
        let rounded_px = look.rounded;
        let line1 = format!(
            "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\"
            stroke-width=\"{}\" stroke=\"{}\" rx=\"{}\" {} />\n",
            xy.x,
            xy.y,
            size.x,
            size.y,
            fill_color.to_web_color(),
            stroke_width,
            stroke_color.to_web_color(),
            rounded_px,
            clip_option
        );
        self.content.push_str(&line1);
    }

    fn draw_circle(&mut self, xy: Point, size: Point, look: &StyleAttr) {
        self.grow_window(xy, size);
        let fill_color = look.fill_color.unwrap_or_else(Color::transparent);
        let stroke_width = look.line_width;
        let stroke_color = look.line_color;

        let line1 = format!(
            "<ellipse cx=\"{}\" cy=\"{}\" rx=\"{}\" ry=\"{}\" fill=\"{}\"
            stroke-width=\"{}\" stroke=\"{}\"/>\n",
            xy.x,
            xy.y,
            size.x / 2.,
            size.y / 2.,
            fill_color.to_web_color(),
            stroke_width,
            stroke_color.to_web_color()
        );
        self.content.push_str(&line1);
    }

    fn draw_text(&mut self, xy: Point, text: &str, look: &StyleAttr) {
        if let Ok(course) = from_str::<CourseMapCourse>(text) {
            println!("{course:?}");
        }

        let len = text.len();

        let mut content = String::new();
        let cnt = 1 + text.lines().count();
        let size_y = (cnt * look.font_size) as f64;
        for line in text.lines() {
            content.push_str(&format!("<tspan x = \"{}\" dy=\"1.0em\">", xy.x));
            content.push_str(&escape_string(line));
            content.push_str("</tspan>");
        }

        self.grow_window(xy, Point::new(10., len as f64 * 10.));
        let line = format!(
            "<text dominant-baseline=\"middle\" text-anchor=\"middle\"
            x=\"{}\" y=\"{}\">{}</text>",
            xy.x,
            xy.y - size_y / 2.,
            &content
        );

        self.content.push_str(&line);
    }

    fn draw_arrow(
        &mut self,
        // This is a list of vectors. The first vector is the "exit" vector
        // from the first point, and the rest of the vectors are "entry" vectors
        // into the following points.
        path: &[(Point, Point)],
        dashed: bool,
        head: (bool, bool),
        look: &StyleAttr,
        text: &str,
    ) {
        // Control points as defined in here:
        // https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#curve_commands
        // Structured as [(M,C) S S S ...]
        for point in path {
            self.grow_window(point.0, Point::zero());
            self.grow_window(point.1, Point::zero());
        }

        let dash = if dashed {
            &"stroke-dasharray=\"5,5\""
        } else {
            &""
        };
        let start = if head.0 {
            "marker-start=\"url(#startarrow)\""
        } else {
            ""
        };
        let end = if head.1 {
            "marker-end=\"url(#endarrow)\""
        } else {
            ""
        };

        let mut path_builder = String::new();

        // Handle the "exit vector" from the first point.
        path_builder.push_str(&format!(
            "M {} {} C {} {}, {} {}, {} {} ",
            path[0].0.x,
            path[0].0.y,
            path[0].1.x,
            path[0].1.y,
            path[1].0.x,
            path[1].0.y,
            path[1].1.x,
            path[1].1.y
        ));

        // Handle the "entry vector" from the rest of the points.
        for point in path.iter().skip(2) {
            path_builder.push_str(&format!(
                "S {} {}, {} {} ",
                point.0.x, point.0.y, point.1.x, point.1.y
            ));
        }

        let stroke_width = look.line_width;
        let stroke_color = look.line_color;

        let line = format!(
            "<path id=\"arrow{}\" d=\"{}\" \
            stroke=\"{}\" stroke-width=\"{}\" {} {} {}
            fill=\"transparent\" />\n",
            self.counter,
            path_builder.as_str(),
            stroke_color.to_web_color(),
            stroke_width,
            dash,
            start,
            end
        );
        self.content.push_str(&line);

        let line = format!(
            "<text><textPath href=\"#arrow{}\" startOffset=\"50%\" \
            text-anchor=\"middle\">{}</textPath></text>",
            self.counter,
            escape_string(text)
        );
        self.content.push_str(&line);
        self.counter += 1;
    }

    fn draw_line(&mut self, start: Point, stop: Point, look: &StyleAttr) {
        let stroke_width = look.line_width;
        let stroke_color = look.line_color;
        let line1 = format!(
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke-width=\"{}\"
             stroke=\"{}\" />\n",
            start.x,
            start.y,
            stop.x,
            stop.y,
            stroke_width,
            stroke_color.to_web_color()
        );
        self.content.push_str(&line1);
    }

    fn create_clip(&mut self, xy: Point, size: Point, rounded_px: usize) -> ClipHandle {
        let handle = self.clip_regions.len();

        let clip_code = format!(
            "<clipPath id=\"C{}\"><rect x=\"{}\" y=\"{}\" \
            width=\"{}\" height=\"{}\" rx=\"{}\" /> \
            </clipPath>",
            handle, xy.x, xy.y, size.x, size.y, rounded_px
        );

        self.clip_regions.push(clip_code);

        handle
    }
}
