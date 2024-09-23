import {
	Course,
	CourseCompletionTextbookData,
	CourseProgress,
	displayError,
	setActiveCourses,
	setCourseCompletion,
} from "../bindings.ts";
import { BookChapterGraph } from "../graphing/main.ts";
import { isCompletable, isComplete, isStarted, sortCourses } from "../util.ts";

const listingElements: Map<string, HTMLAnchorElement> = new Map();

export function buildCourseListing(
	courses: [Course, CourseProgress][],
	active: Set<string>,
	contentViewer: HTMLElement,
	styleContainer: HTMLStyleElement,
): [DocumentFragment, Map<string, [Course, CourseProgress]>] {
	const fragment = document.createDocumentFragment();

	if (courses.length == 0) {
		const header = document.createElement("h2");
		header.innerText = "⚠️ No Courses Found!";

		fragment.appendChild(header);

		const message = document.createElement("span");
		message.innerHTML =
			"📥&nbsp;Import 📚&nbsp;Courses into the </br>📂&nbsp;Resource&nbsp;Folder, then </br>🔄&nbsp;Refresh the navigator.";

		fragment.appendChild(message);

		contentViewer.innerHTML =
			'<p>See the <a href="guide.html" style="text-decoration: underline">📜&nbsp;Guide</a> for further information.</p>';

		return [fragment, new Map()];
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

				styleContainer.innerHTML =
					"#course-" + course[0].uuid + " {font-weight: bold}";
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

	return [fragment, courseMap];
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

		listingElements.set(course.uuid, label);

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
		wrapper.href = "/subviewer.html?" + params.toString();

		const chapterGraph = new BookChapterGraph(book.chapters.length, book.label);
		chapterGraph.update(progress.completion[i]?.chapter_completion);

		wrapper.appendChild(chapterGraph.element);
		section.appendChild(wrapper);

		root.appendChild(section);
		root.appendChild(document.createElement("br"));
	}

	if (course.books.length > 0 && isCompletable(course)) {
		const optionsWrapper = document.createElement("details");

		const title = document.createElement("summary");
		title.innerHTML = "🛠️ Edit Progress";
		optionsWrapper.appendChild(title);

		const warning = document.createElement("p");
		warning.innerHTML =
			"⚠️ These actions will apply <strong>without further confirmation</strong>.";
		optionsWrapper.appendChild(warning);

		const completeButton = document.createElement("button");
		completeButton.type = "button";
		completeButton.innerText = "🏆 Mark As Completed";
		completeButton.addEventListener("click", () => {
			updateCourseCompletion(course, true);
		});
		completeButton.addEventListener("keydown", (event) => {
			if (event.code == "Enter") {
				updateCourseCompletion(course, true);
			}
		});

		optionsWrapper.appendChild(completeButton);

		const resetButton = document.createElement("button");
		resetButton.type = "button";
		resetButton.innerText = " Clear All Progress";
		resetButton.addEventListener("click", () => {
			updateCourseCompletion(course, false);
		});
		resetButton.addEventListener("keydown", (event) => {
			if (event.code == "Enter") {
				updateCourseCompletion(course, false);
			}
		});
		optionsWrapper.appendChild(resetButton);

		root.appendChild(optionsWrapper);
	}

	return root;
}

function updateCourseCompletion(course: Course, completed: boolean) {
	if (completed) {
		const books: Record<number, CourseCompletionTextbookData> = {};

		let i = 0;
		for (const textbook of course.books) {
			const sections: string[] = [];

			for (const chapter of textbook.chapters) {
				if (chapter.root) {
					sections.push(chapter.root);
				}

				for (const group of chapter.groups) {
					sections.push.apply(group.sections);
				}
			}

			books[i] = {
				completed_sections: sections,
			};

			i++;
		}

		setCourseCompletion(course, {
			time_spent: {},
			books,
		});
	} else {
		setCourseCompletion(course, {
			time_spent: {},
			books: {},
		});
	}

	location.reload();
}

export function displayCourse(
	course: Course,
	progress: CourseProgress,
	contentViewer: HTMLElement,
	styleContainer: HTMLStyleElement,
) {
	contentViewer.innerHTML = "";
	contentViewer.appendChild(buildCourseInfo(course, progress));

	styleContainer.innerHTML = "#course-" + course.uuid + " {font-weight: bold}";

	const element = listingElements.get(course.uuid);

	if (element) {
		const details = element?.parentElement?.parentElement?.parentElement;

		if (details && details.tagName == "DETAILS") {
			(details as HTMLDetailsElement).open = true;
		}
	}
}
