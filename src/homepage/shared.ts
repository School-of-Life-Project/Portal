import { Course, CourseProgress, Settings } from "../bindings.ts";
import {
	TimeProgressMeter,
	BookChapterGraph,
	//LongTermProgressGraph,
} from "../graphing/main.ts";

export function graphCourse(
	settings: Settings,
	course: Course,
	progress: CourseProgress,
) {
	const element = document.createElement("section");
	element.className = "course";

	const title = document.createElement("h3");
	title.innerText = course.title;

	element.appendChild(title);

	for (let i = 0; i < course.books.length; i++) {
		const book = course.books[i];

		const params = new URLSearchParams();
		params.set("uuid", course.uuid);
		params.set("document_index", String(i));

		const chapterGraph = new BookChapterGraph(book.chapters.length, book.label);
		chapterGraph.update(progress.completion[i].chapter_completion);

		const containerInner = document.createElement("a");
		containerInner.href = "/viewer.html?" + params.toString();

		const container = document.createElement("div");
		container.className = "textbook";

		containerInner.appendChild(chapterGraph.element);
		container.appendChild(containerInner);

		element.appendChild(container);
	}

	const meter = new TimeProgressMeter(0, settings.maximum_course_time * 60);
	meter.update(progress.time_spent_today);

	element.appendChild(meter.element);

	return element;
}
