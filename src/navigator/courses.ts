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
	contentViewer: HTMLElement,
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

	const courseMap: Map<string, [Course, CourseProgress]> = new Map();
	const startedCourses: Course[] = [];
	const completableCourses: Course[] = [];
	const incompletableCourses: Course[] = [];
	const completedCourses: Course[] = [];
	let openCompletedCourses = false;
	let openCompletableCourses = false;
	let openIncompletableCourses = false;

	for (const [course, courseProgress] of courses) {
		courseMap.set(course.uuid, [course, courseProgress]);
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
					if (active.has(course.uuid)) {
						openCompletableCourses = true;
					}
					completableCourses.push(course);
				}
			} else {
				if (active.has(course.uuid)) {
					openIncompletableCourses = true;
				}
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
			buildCourseCategory(
				"New Courses",
				completableCourses,
				active,
				openCompletableCourses,
			),
		);
	}

	if (incompletableCourses.length > 0) {
		list.appendChild(
			buildCourseCategory(
				"Incompletable Courses (missing metadata)",
				incompletableCourses,
				active,
				openIncompletableCourses,
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

	const clickListener = (event: Event) => {
		const target = event.target as HTMLElement;

		if (target.tagName == "A" && target.parentElement) {
			const identifier = target.parentElement.id.substring(7);
			const course = courseMap.get(identifier);

			if (course) {
				contentViewer.innerHTML = "";
				contentViewer.appendChild(buildCourseInfo(course[0], course[1]));
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

		const label = document.createElement("a");
		label.setAttribute("tabindex", "0");
		label.setAttribute("role", "button");
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

function buildCourseInfo(course: Course, progress: CourseProgress) {
	const root = document.createDocumentFragment();

	const title = document.createElement("h2");
	title.innerText = course.title;
	root.appendChild(title);

	if (course.description) {
		const description = document.createElement("p");
		description.innerText = course.description;
		root.appendChild(description);
	}

	const bookListTitle = document.createElement("h3");
	bookListTitle.innerText = "Contents";
	root.appendChild(bookListTitle);

	const bookList = document.createElement("ul");

	let i = 0;
	for (const textbook of course.books) {
		const item = document.createElement("li");
		item.innerText = textbook.label;

		if (textbook.chapters.length > 0) {
			let completion = 0;
			if (progress.completion.length > i) {
				completion = progress.completion[i].overall_completion;
			}

			item.innerText += " (" + textbook.chapters.length + " chapters)";

			if (completion == 1) {
				item.innerText += " ✔️";
			} else if (completion > 0) {
				item.innerText += " [" + Math.floor(completion * 100) + "% complete]";
			}
		} else {
			item.innerText += " (missing metadata)";
		}

		i++;
		bookList.appendChild(item);
	}

	root.appendChild(bookList);

	return root;
}
