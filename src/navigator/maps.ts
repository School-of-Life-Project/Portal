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
	//root.getElementsByTagName("style")[0].innerHTML = "";

	//console.log(getCourseMapBoxes(root));

	console.log(root);
}

/*interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Point {
	x: number;
	y: number;
}

function withinBoundingBox(box: BoundingBox, point: Point) {
	const max_x = box.x + box.width;
	const max_y = box.y + box.height;

	return (
		point.x >= box.x &&
		point.y >= point.y &&
		point.x <= max_x &&
		point.y <= max_y
	);
}

function getCourseMapBoxes(root: SVGSVGElement) {
	const boundingBoxes: BoundingBox[] = [];

	for (const element of root.getElementsByTagName("rect")) {
		boundingBoxes.push({
			x: element.x.baseVal.value,
			y: element.y.baseVal.value,
			width: element.width.baseVal.value,
			height: element.height.baseVal.value,
		});
	}

	const courseBoxes: Map<string, BoundingBox> = new Map();

	for (const outerElement of root.getElementsByTagName("text")) {
		if (
			outerElement.x.baseVal.length == 0 ||
			outerElement.y.baseVal.length == 0
		) {
			continue;
		}

		const outerLocation: Point = {
			x: outerElement.x.baseVal.getItem(0).value,
			y: outerElement.y.baseVal.getItem(0).value,
		};

		for (const element of outerElement.getElementsByTagName("tspan")) {
			const location = outerLocation;

			if (element.x.baseVal.length != 0) {
				location.x = element.x.baseVal.getItem(0).value;
			}

			if (element.y.baseVal.length != 0) {
				location.y = element.y.baseVal.getItem(0).value;
			}

			const identifier = element.innerHTML;

			if (identifier.length != 36) {
				continue;
			}

			for (const box of boundingBoxes) {
				if (withinBoundingBox(box, location)) {
					courseBoxes.set(identifier, box);
					break;
				}
			}

			element.remove();
		}
	}

	return courseBoxes;
}
*/
