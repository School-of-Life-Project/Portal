import {
	displayError,
	getActive,
	getOverallProgress,
	getSettings,
} from "../bindings.ts";
import {
	displayEmptyCourseNotice,
	graphCourse,
	graphProgress,
	sortCourses,
} from "./shared.ts";

const settingsPromise = getSettings().catch((error) => {
	displayError(error);
});

const coursePromise = getActive().catch((error) => {
	displayError(error);
});

const progressPromise = getOverallProgress().catch((error) => {
	displayError(error);
});

const courseContainer = document.getElementById("activeCourses");
const progressContainer = document.getElementById("progressGraphs");
const settings = await settingsPromise;

if (courseContainer && progressContainer && settings) {
	coursePromise.then((courses) => {
		if (!courses) {
			return;
		}

		if (courses.length == 0) {
			const element = displayEmptyCourseNotice();

			courseContainer.innerHTML = "";
			courseContainer.appendChild(element);
		} else {
			sortCourses(courses);

			const fragment = document.createDocumentFragment();

			for (const course of courses) {
				fragment.appendChild(graphCourse(settings, course[0], course[1]));
			}

			courseContainer.innerHTML = "";
			courseContainer.appendChild(fragment);
		}
	});

	progressPromise.then((progress) => {
		if (!progress) {
			return;
		}

		const [timeGraph, sectionGraph] = graphProgress(settings, progress);

		const fragment = document.createDocumentFragment();
		fragment.appendChild(timeGraph);
		fragment.appendChild(sectionGraph);

		progressContainer.innerHTML = "";
		progressContainer.appendChild(fragment);
	});
}
