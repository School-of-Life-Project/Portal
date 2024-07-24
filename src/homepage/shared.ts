import {
	Course,
	CourseProgress,
	OverallProgress,
	parseBackendDate,
	Settings,
} from "../bindings.ts";
import {
	TimeProgressMeter,
	BookChapterGraph,
	LongTermProgressGraph,
} from "../graphing/main.ts";

// Copied from https://stackoverflow.com/a/17727953
function daysBetween(StartDate: Date, EndDate: Date) {
	const oneDay = 1000 * 60 * 60 * 24;

	const start = Date.UTC(
		EndDate.getFullYear(),
		EndDate.getMonth(),
		EndDate.getDate(),
	);
	const end = Date.UTC(
		StartDate.getFullYear(),
		StartDate.getMonth(),
		StartDate.getDate(),
	);

	return (start - end) / oneDay;
}

function sortProgressData(data: Record<string, number>) {
	const sortedTimeData: Array<[Date, number]> = [];
	for (const [dateString, value] of Object.entries(data)) {
		sortedTimeData.push([parseBackendDate(dateString), value]);
	}

	sortedTimeData.sort((a, b) => {
		if (a[0] < b[0]) {
			return 1;
		} else if (a[0] > b[0]) {
			return -1;
		} else {
			return 0;
		}
	});

	return sortedTimeData;
}

export function sortCourses(courses: [Course, CourseProgress][]) {
	courses.sort((a, b) => {
		const newA = a[0].title;
		const newB = b[0].title;

		if (newA < newB) {
			return -1;
		} else if (newA > newB) {
			return 1;
		} else {
			return 0;
		}
	});
}

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
		element.appendChild(document.createElement("br"));
	}

	const meter = new TimeProgressMeter(0, settings.maximum_course_time * 60);
	meter.update(progress.time_spent_today);

	element.appendChild(meter.element);

	return element;
}

export function displayEmptyCourseNotice() {
	const element = document.createElement("section");
	element.className = "course";

	const title = document.createElement("h3");
	title.innerText = "No courses found!";

	const description = document.createElement("p");
	description.innerText =
		"Try using the Course Navigator to update your list of active courses.";

	element.appendChild(title);
	element.appendChild(description);

	return element;
}

const dayMappings = [6, 5, 4, 3, 2, 1, 0];

export function graphProgress(
	settings: Settings,
	progress: OverallProgress,
): [HTMLElement, HTMLElement] {
	const currentDate = new Date();

	const timeData = sortProgressData(progress.time_spent);
	const chapterData = sortProgressData(progress.chapters_completed);

	let daysSinceLastTimeData = 0;
	if (timeData.length > 0) {
		daysSinceLastTimeData = daysBetween(
			currentDate,
			timeData[timeData.length - 1][0],
		);
	}
	let daysSinceLastChapterData = 0;
	if (chapterData.length > 0) {
		daysSinceLastChapterData = daysBetween(
			currentDate,
			chapterData[chapterData.length - 1][0],
		);
	}

	const currentDayIndex = dayMappings[currentDate.getDay()];

	const timeProgress: number[] = [];
	const chapterProgress: number[] = [];

	for (let i = 0; i < currentDayIndex; i++) {
		timeProgress.push(NaN);
		chapterProgress.push(NaN);
	}

	for (let i = 0; i < daysSinceLastTimeData; i++) {
		timeProgress.push(0);
	}

	for (let i = 0; i < daysSinceLastChapterData; i++) {
		chapterProgress.push(0);
	}

	let lastDate: Date | undefined;

	for (const [date, data] of timeData) {
		if (!lastDate) {
			lastDate = date;
		} else {
			for (let ii = 1; ii < daysBetween(date, lastDate); ii++) {
				timeProgress.push(0);
			}
			lastDate = date;
		}

		timeProgress.push(data);
	}

	lastDate = undefined;
	for (const [date, data] of chapterData) {
		if (!lastDate) {
			lastDate = date;
		} else {
			for (let ii = 1; ii < daysBetween(date, lastDate); ii++) {
				chapterProgress.push(0);
			}
			lastDate = date;
		}

		chapterProgress.push(data);
	}

	if (timeData.length == 0) {
		timeProgress.push(0);
	}

	if (chapterData.length == 0) {
		chapterProgress.push(0);
	}

	const timeGraph = new LongTermProgressGraph(
		"time",
		settings.weeks_displayed,
		0,
		settings.maximum_daily_time * 60,
	);
	const chapterGraph = new LongTermProgressGraph(
		"chapter",
		settings.weeks_displayed,
		0,
		settings.maximum_daily_chapters,
	);
	timeGraph.update(timeProgress, currentDayIndex);
	chapterGraph.update(chapterProgress, currentDayIndex);

	const timeSection = document.createElement("section");

	const timeTitle = document.createElement("h3");
	timeTitle.innerText = "⏳ Time Spent Studying Per Day";

	timeSection.appendChild(timeTitle);
	timeSection.appendChild(timeGraph.element);

	const chapterSection = document.createElement("section");

	const chapterTitle = document.createElement("h3");
	chapterTitle.innerText = "📚 Chapters Completed Per Day";

	chapterSection.appendChild(chapterTitle);
	chapterSection.appendChild(chapterGraph.element);

	return [timeSection, chapterSection];
}
