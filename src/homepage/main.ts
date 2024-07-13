import {
	displayError,
	getCourses,
	getOverallProgress,
	getSettings,
} from "../bindings.ts";
import { graphCourse, graphProgress, sortCourses } from "./shared.ts";

const settingsPromise = getSettings().catch((error) => {
	displayError({
		message: "Unable to get Settings",
		cause: JSON.stringify(error),
	});
});

// TODO: Replace getCourses() with getActiveCourses()
const coursePromise = getCourses().catch((error) => {
	displayError({
		message: "Unable to get active Courses",
		cause: JSON.stringify(error),
	});
});

const progressPromise = getOverallProgress().catch((error) => {
	displayError({
		message: "Unable to get overall Progress",
		cause: JSON.stringify(error),
	});
});

const courseContainer = document.getElementById("activeCourses");
const progressContainer = document.getElementById("progressGraphs");
const settings = await settingsPromise;

if (courseContainer && progressContainer && settings) {
	coursePromise.then((courses) => {
		if (!courses) {
			return;
		}

		sortCourses(courses);

		courseContainer.innerHTML = "";

		for (const course of courses) {
			if (course.Ok) {
				courseContainer.appendChild(
					graphCourse(settings, course.Ok[0], course.Ok[1]),
				);
			}
		}
	});

	progressPromise.then((progress) => {
		if (!progress) {
			return;
		}

		const [timeGraph, sectionGraph] = graphProgress(settings, progress);

		progressContainer.innerHTML = "";

		progressContainer.appendChild(timeGraph);
		progressContainer.appendChild(sectionGraph);
	});
}
