import { Course, CourseProgress } from "./bindings";

export function sortCourses(
	courses: [Course, CourseProgress][],
	activeCourses?: Set<string>,
) {
	courses.sort((a, b) => {
		if (activeCourses) {
			const activeA = activeCourses.has(a[0].uuid);
			const activeB = activeCourses.has(b[0].uuid);

			if (activeB && !activeA) {
				return 1;
			} else if (activeA && !activeB) {
				return -1;
			}
		}

		const titleA = a[0].title;
		const titleB = b[0].title;

		if (titleA < titleB) {
			return -1;
		} else if (titleA > titleB) {
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
