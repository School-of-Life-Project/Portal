import {
	Course,
	CourseProgress,
	displayError,
	setActiveCourses,
} from "../bindings.ts";
import { isCompletable, isComplete, isStarted, sortCourses } from "../util.ts";

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

	sortCourses(courses, active);

	const header = document.createElement("h2");
	header.innerText = "Your Courses";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	const startedCourses: Course[] = [];
	const completableCourses: Course[] = [];
	const incompletableCourses: Course[] = [];
	const completedCourses: Course[] = [];
	let openCompletedCourses = false;

	for (const [course, courseProgress] of courses) {
		if (isComplete(courseProgress)) {
			completedCourses.push(course);
			if (active.has(course.uuid)) {
				openCompletedCourses = true;
			}
		} else {
			if (isCompletable(course)) {
				if (isStarted(courseProgress)) {
					startedCourses.push(course);
				} else {
					completableCourses.push(course);
				}
			} else {
				incompletableCourses.push(course);
			}
		}
	}

	if (completedCourses.length > 0) {
		list.appendChild(
			buildCourseCategory(
				"Completed Courses",
				completedCourses,
				active,
				openCompletedCourses,
			),
		);
	}

	if (startedCourses.length > 0) {
		list.appendChild(
			buildCourseCategory("Started Courses", startedCourses, active, true),
		);
	}

	if (completableCourses.length > 0) {
		list.appendChild(
			buildCourseCategory("New Courses", completableCourses, active, true),
		);
	}

	if (incompletableCourses.length > 0) {
		list.appendChild(
			buildCourseCategory(
				"Incompletable Courses (missing metadata)",
				incompletableCourses,
				active,
				true,
			),
		);
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

function buildCourseCategory(
	label: string,
	courses: Course[],
	active: Set<string>,
	open?: boolean,
) {
	const category = document.createElement("details");

	const title = document.createElement("summary");
	title.innerText = label;
	category.appendChild(title);

	category.appendChild(buildCourseSubListing(courses, active));

	if (open) {
		category.open = true;
	}

	const container = document.createElement("li");
	container.appendChild(category);

	return container;
}

function buildCourseSubListing(courses: Course[], active: Set<string>) {
	const list = document.createElement("ul");

	for (const course of courses) {
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

	return list;
}
