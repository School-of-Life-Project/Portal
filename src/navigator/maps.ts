import { CourseMap } from "../bindings";

export function buildCourseMapListing(
	courseMaps: [CourseMap, string][],
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	const header = document.createElement("h2");
	header.innerText = "Your Course Maps";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	for (const [courseMap, _] of courseMaps) {
		const element = document.createElement("li");
		element.innerText = courseMap.title;

		list.appendChild(element);
	}

	fragment.appendChild(list);

	if (courseMaps.length != 0) {
		fragment.appendChild(document.createElement("br"));
	}

	return fragment;
}
