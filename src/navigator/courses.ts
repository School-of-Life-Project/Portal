import {
	Course,
	CourseProgress,
	displayError,
	setActiveCourses,
} from "../bindings.ts";

export function buildCourseListing(
	courses: [Course, CourseProgress][],
	active: Set<string>,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	if (courses.length == 0) {
		const header = document.createElement("h2");
		header.innerText = "No courses found!";

		fragment.appendChild(header);

		const message = document.createElement("span");
		message.innerText =
			"Try importing some courses into the resource folder, and then refreshing the navigator.";

		fragment.appendChild(message);

		return fragment;
	}

	const header = document.createElement("h2");
	header.innerText = "Your Courses";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	for (const [course, _courseProgress] of courses) {
		const element = document.createElement("li");
		element.id = "course-" + course.uuid;

		const label = document.createElement("span");
		label.innerText = course.title;
		element.appendChild(label);

		const checkbox = document.createElement("input");
		checkbox.setAttribute("type", "checkbox");
		if (active.has(course.uuid)) {
			checkbox.checked = true;
		}
		element.appendChild(checkbox);

		list.appendChild(element);
	}

	list.addEventListener("change", (event) => {
		const target = event.target as HTMLElement;

		if (target.tagName == "INPUT" && target.parentElement) {
			const identifier = target.parentElement.id.substring(7);
			const checked = (target as HTMLInputElement).checked;

			if (checked) {
				active.add(identifier);
			} else {
				active.delete(identifier);
			}

			setActiveCourses(Array.from(active)).catch((error) => {
				displayError(error);
			});
		}
	});

	fragment.appendChild(list);

	return fragment;
}
