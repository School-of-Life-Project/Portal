import {
	applyTheme,
	displayError,
	getActive,
	getBackendDate,
	getOverallProgress,
	getSettings,
} from "../bindings.ts";
import { sortCourses } from "../util.ts";
import {
	displayEmptyCourseNotice,
	graphCourse,
	graphProgress,
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

		console.log(courses);

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

		if (!(settings.show_daily_time || settings.show_daily_chapters)) {
			const heading = document.getElementById("progressHeader");

			if (heading) {
				heading.style.display = "none";
			}

			progressContainer.innerHTML = "";
			return;
		}

		console.log(progress);

		const [timeGraph, sectionGraph] = graphProgress(settings, progress);

		const fragment = document.createDocumentFragment();
		if (settings.show_daily_time) {
			fragment.appendChild(timeGraph);
		}

		if (settings.show_daily_chapters) {
			fragment.appendChild(sectionGraph);
		}

		progressContainer.innerHTML = "";
		progressContainer.appendChild(fragment);
	});

	applyTheme(settings);

	getBackendDate()
		.then((lastBackendDate) => {
			window.setInterval(() => {
				getBackendDate()
					.then((currentBackendDate) => {
						if (currentBackendDate != lastBackendDate) {
							console.log(lastBackendDate, currentBackendDate);
							location.reload();
						}
					})
					.catch((error) => {
						displayError(error);
					});
			}, 15000);
		})
		.catch((error) => {
			displayError(error);
		});
}
