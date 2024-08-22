import { Course, CourseMap, CourseProgress, displayError } from "../bindings";
import { isCompletable, isComplete, isStarted, sortCourseMaps } from "../util";

export function buildCourseMapListing(
	courseMapping: Map<string, [Course, CourseProgress]>,
	courseMaps: [CourseMap, string][],
	contentViewer: HTMLElement,
	styleContainer: HTMLStyleElement,
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
					buildCourseMapInfo(courseMap[0], courseMap[1], courseMapping),
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

	const image = document.createElement("div");
	image.innerHTML = svg;

	const svgElement = image.getElementsByTagName("svg")[0];

	svgElement.getElementsByTagName("style")[0].innerHTML +=
		" .course-map-item {cursor: pointer} .course-map-item:focus {background-color: var(--primary-border-color)}";

	for (const element of svgElement.getElementsByTagName("foreignObject")) {
		if (element.childNodes.length == 1) {
			const item = element.childNodes[0] as HTMLElement;

			if (item.classList.contains("course-map-item")) {
				item.setAttribute("role", "button");
				item.setAttribute("tabindex", "0");

				const identifier = item.classList.item(1)?.substring(16);

				if (identifier) {
					const course = courseMapping.get(identifier);

					if (course) {
						if (isCompletable(course[0])) {
							const paragraph = item.childNodes[0] as HTMLParagraphElement;

							if (isComplete(course[1])) {
								paragraph.innerText += " 🏆";
							} else if (isStarted(course[1])) {
								paragraph.innerText += " ✏️";
							}
						}
					} else {
						displayError({
							message: "Unable to find Course " + identifier,
							cause: "Error occured while parsing CourseMap " + courseMap.uuid,
						});
					}
				}
			}
		}
	}

	svgElement.addEventListener("click", (event) => {
		const target = event.target as Element;

		if (target.tagName == "DIV" || target.tagName == "P") {
			console.log(target);
		}
	});
	svgElement.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			const target = event.target as Element;

			if (target.tagName == "DIV" || target.tagName == "P") {
				console.log(target);
			}
		}
	});

	root.appendChild(image);

	return root;
}

// Next plans:
// - Allow clicking on a Course to view it's details
