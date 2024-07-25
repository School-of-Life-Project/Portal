import { Course, CourseProgress } from "./bindings";

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

export function isComplete(progress: CourseProgress): boolean {
	let completed = progress.completion.length > 0;

	for (const textbookProgress of progress.completion) {
		if (textbookProgress.overall_completion != 1) {
			completed = false;
		}
	}

	return completed;
}
