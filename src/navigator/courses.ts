import {
	Course,
	CourseProgress,
	displayError,
	setActiveCourses,
} from "../bindings.ts";
import { isComplete, sortCourses } from "../util.ts";

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

	sortCourses(courses);

	const header = document.createElement("h2");
	header.innerText = "Your Courses";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	const completedCourses: Course[] = [];

	for (const [course, courseProgress] of courses) {
		if (isComplete(courseProgress)) {
			completedCourses.push(course);
		} else {
			list.appendChild(buildCourseListItem(course, active.has(course.uuid)));
		}
	}

	if (completedCourses.length > 0) {
		const completed = document.createElement("details");

		const completedTitle = document.createElement("summary");
		completedTitle.innerText = "Completed Courses";
		completed.appendChild(completedTitle);

		const completedList = document.createElement("ul");

		for (const course of completedCourses) {
			completedList.appendChild(
				buildCourseListItem(course, active.has(course.uuid)),
			);

			if (active.has(course.uuid)) {
				completed.open = true;
			}
		}

		completed.appendChild(completedList);

		list.appendChild(completed);
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

function buildCourseListItem(course: Course, active: boolean) {
	const element = document.createElement("li");
	element.id = "course-" + course.uuid;

	const label = document.createElement("span");
	label.innerText = course.title;
	element.appendChild(label);

	const checkbox = document.createElement("input");
	checkbox.setAttribute("type", "checkbox");
	if (active) {
		checkbox.checked = true;
	}
	element.appendChild(checkbox);

	return element;
}
