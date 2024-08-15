import { CourseMap } from "../bindings";

export function buildCourseMapListing(
	courseMaps: [CourseMap, string][],
	contentViewer: HTMLElement,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	const header = document.createElement("h2");
	header.innerText = "🗺️ Course Maps";

	fragment.appendChild(header);

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
					buildCourseMapInfo(courseMap[0], courseMap[1]),
				);
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

function buildCourseMapInfo(courseMap: CourseMap, svg: string) {
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
	image.classList.add("image");
	image.innerHTML = svg;

	const svgElement = image.getElementsByTagName("svg")[0];

	stylizeCourseMapSvg(svgElement);

	root.appendChild(image);

	return root;
}

function stylizeCourseMapSvg(root: SVGSVGElement) {
	const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
	style.innerHTML = "p {padding: 1em}";

	root.appendChild(style);

	console.log(root);
}
