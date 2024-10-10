import {
	Course,
	CourseMap,
	CourseProgress,
	displayError,
	Settings,
} from "../bindings";
import { isCompletable, isComplete, isStarted, sortCourseMaps } from "../util";
import { displayCourse } from "./courses";

export function buildCourseMapListing(
	courseMapping: Map<string, [Course, CourseProgress]>,
	courseMaps: [CourseMap, string][],
	contentViewer: HTMLElement,
	styleContainer: HTMLStyleElement,
	settings: Settings,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	const header = document.createElement("h2");
	header.innerText = "🗺️ Course Maps";

	fragment.appendChild(header);

	sortCourseMaps(courseMaps);

	const list = document.createElement("ul");

	const courseMapMap: Map<string, [CourseMap, string]> = new Map();

	for (const [courseMap, svg] of courseMaps) {
		const element = document.createElement("li");
		element.id = "map-" + courseMap.uuid;

		const label = document.createElement("a");
		label.setAttribute("tabindex", "0");
		label.setAttribute("role", "button");
		label.innerText = courseMap.title;

		element.appendChild(label);

		courseMapMap.set(courseMap.uuid, [courseMap, svg]);

		list.appendChild(element);
	}

	const clickListener = (event: Event) => {
		const target = event.target as HTMLElement;

		if (target.tagName == "A" && target.parentElement) {
			const identifier = target.parentElement.id.substring(4);
			const courseMap = courseMapMap.get(identifier);

			if (courseMap) {
				contentViewer.innerHTML = "";
				contentViewer.appendChild(
					buildCourseMapInfo(
						courseMap[0],
						courseMap[1],
						courseMapping,
						contentViewer,
						styleContainer,
						settings,
					),
				);

				styleContainer.innerHTML =
					"#map-" + courseMap[0].uuid + " {font-weight: bold}";
			}
		}
	};

	list.addEventListener("click", clickListener);
	list.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			clickListener(event);
		}
	});

	fragment.appendChild(list);

	if (courseMaps.length != 0) {
		fragment.appendChild(document.createElement("br"));
	}

	return fragment;
}

function buildCourseMapInfo(
	courseMap: CourseMap,
	svg: string,
	courseMapping: Map<string, [Course, CourseProgress]>,
	contentViewer: HTMLElement,
	styleContainer: HTMLStyleElement,
	settings: Settings,
) {
	const root = document.createDocumentFragment();

	const title = document.createElement("h2");
	title.innerText = "🗺️ " + courseMap.title;
	root.appendChild(title);

	if (courseMap.description) {
		const description = document.createElement("p");
		description.innerText = courseMap.description;
		root.appendChild(description);
	}

	if (svg.length == 0) {
		return root;
	}

	const image = document.createElement("div");
	image.innerHTML = svg;

	const svgElement = image.getElementsByTagName("svg")[0];

	svgElement.getElementsByTagName("style")[0].innerHTML +=
		" .course-map-item {cursor: pointer; outline-offset: -0.5lh}";

	if (settings.custom_map_css) {
		const element = document.createElement("style");
		element.innerText = settings.custom_map_css;

		svgElement.appendChild(element);
	}

	const items: SVGForeignObjectElement[] = [];

	const elements = svgElement.getElementsByTagName("foreignObject");

	while (elements.length > 0) {
		for (const element of elements) {
			svgElement.removeChild(element);
			items.push(element);
		}
	}

	items.sort((a, b) => {
		const aY = a.y.baseVal.value;
		const aX = a.x.baseVal.value;
		const bY = b.y.baseVal.value;
		const bX = b.x.baseVal.value;

		if (aY < bY) {
			return -1;
		} else if (aY > bY) {
			return 1;
		} else {
			if (aX < bX) {
				return -1;
			} else if (aX > bX) {
				return 1;
			} else {
				return 0;
			}
		}
	});

	for (const element of items) {
		if (element.childNodes.length == 1) {
			const item = element.childNodes[0] as HTMLElement;

			if (item.classList.contains("course-map-item")) {
				item.setAttribute("role", "button");
				item.setAttribute("tabindex", "0");

				const identifier = item.classList.item(1)?.substring(16);

				if (identifier) {
					const course = courseMapping.get(identifier);

					if (course) {
						const paragraph = item.childNodes[0] as HTMLParagraphElement;

						if (isCompletable(course[0])) {
							if (isComplete(course[1])) {
								paragraph.innerText += " 🏆";
							} else if (isStarted(course[1])) {
								paragraph.innerText += " ✏️";
							}
						} else {
							paragraph.innerText += " 📒";
						}
					} else {
						displayError({
							message: "Unable to display Course Map " + courseMap.uuid,
							cause: "Course " + identifier + " does not exist",
						});
					}
				}
			}
		}

		svgElement.appendChild(element);
	}

	const handleCourseDisplay = (identifier: string) => {
		const course = courseMapping.get(identifier);

		if (course) {
			displayCourse(course[0], course[1], contentViewer, styleContainer);
		}
	};

	svgElement.addEventListener("click", (event) => {
		let target = event.target as Element;

		if (target.tagName == "P") {
			target = target.parentElement as Element;
		}

		if (
			target.tagName == "DIV" &&
			target.classList.contains("course-map-item")
		) {
			const identifier = target.classList.item(1)?.substring(16);

			if (identifier) {
				handleCourseDisplay(identifier);
			}
		}
	});
	svgElement.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			let target = event.target as Element;

			if (target.tagName == "P") {
				target = target.parentElement as Element;
			}

			if (
				target.tagName == "DIV" &&
				target.classList.contains("course-map-item")
			) {
				const identifier = target.classList.item(1)?.substring(16);

				if (identifier) {
					handleCourseDisplay(identifier);
				}
			}
		}
	});

	root.appendChild(image);

	return root;
}
