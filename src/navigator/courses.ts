import {
	Course,
	CourseProgress,
	displayError,
	setActiveCourses,
} from "../bindings.ts";
import { BookChapterGraph } from "../graphing/main.ts";
import { isCompletable, isComplete, isStarted, sortCourses } from "../util.ts";

export function buildCourseListing(
	courses: [Course, CourseProgress][],
	active: Set<string>,
	contentViewer: HTMLElement,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	if (courses.length == 0) {
		const header = document.createElement("h2");
		header.innerText = "⚠️ No Courses Found!";

		fragment.appendChild(header);

		const message = document.createElement("span");
		message.innerHTML =
			"📥&nbsp;Import 📚&nbsp;Courses into the </br>📂&nbsp;Resource&nbsp;Folder, then </br>🔄&nbsp;Refresh the navigator.";

		fragment.appendChild(message);

		return fragment;
	}

	sortCourses(courses, active);

	const header = document.createElement("h2");
	header.innerText = "📚 Courses";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	const courseMap: Map<string, [Course, CourseProgress]> = new Map();
	const startedCourses: Course[] = [];
	const completableCourses: Course[] = [];
	const incompletableCourses: Course[] = [];
	const completedCourses: Course[] = [];
	let openCompletedCourses = false;
	let openCompletableCourses = active.size == 0;
	let openIncompletableCourses = false;

	for (const [course, courseProgress] of courses) {
		courseMap.set(course.uuid, [course, courseProgress]);
		if (isCompletable(course)) {
			if (isComplete(courseProgress)) {
				completedCourses.push(course);
				if (active.has(course.uuid)) {
					openCompletedCourses = true;
				}
			} else if (isStarted(courseProgress)) {
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

	if (completedCourses.length > 0) {
		list.appendChild(
			buildCourseCategory(
				"🏆 Completed",
				completedCourses,
				active,
				openCompletedCourses,
			),
		);
	}

	if (startedCourses.length > 0) {
		list.appendChild(
			buildCourseCategory("✏️ Started", startedCourses, active, true),
		);
	}

	if (completableCourses.length > 0) {
		list.appendChild(
			buildCourseCategory(
				"📕 New",
				completableCourses,
				active,
				openCompletableCourses,
			),
		);
	}

	if (incompletableCourses.length > 0) {
		list.appendChild(
			buildCourseCategory(
				"📒 Reference",
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
	title.innerText = "📚 " + course.title;
	root.appendChild(title);

	if (course.description) {
		const description = document.createElement("p");
		description.innerText = course.description;
		root.appendChild(description);
	}

	for (let i = 0; i < course.books.length; i++) {
		const book = course.books[i];

		const params = new URLSearchParams();
		params.set("uuid", course.uuid);
		params.set("document_index", String(i));

		const section = document.createElement("section");

		const wrapper = document.createElement("a");
		wrapper.href = "/viewer.html?" + params.toString();

		const chapterGraph = new BookChapterGraph(book.chapters.length, book.label);
		chapterGraph.update(progress.completion[i].chapter_completion);

		wrapper.appendChild(chapterGraph.element);
		section.appendChild(wrapper);

		root.appendChild(section);
		root.appendChild(document.createElement("br"));
	}

	return root;
}
