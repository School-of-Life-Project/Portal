import {
	displayError,
	getSettings,
	setActiveCourses,
	setSettings,
	Settings,
} from "../bindings";

const settingsPromise = getSettings().catch((error) => {
	displayError(error);
});

const resetCoursesButton = document.getElementById("resetCoursesButton");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const settingsForm = document.getElementById("settingsRoot");

function updateSettings(settings?: Settings) {
	setSettings(settings).catch((error) => {
		displayError(error);
	});
}

function resetCourses() {
	setActiveCourses([]).catch((error) => {
		displayError(error);
	});
}

if (resetSettingsButton) {
	resetSettingsButton.addEventListener("click", () => {
		updateSettings();
		location.reload();
	});
	resetSettingsButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			updateSettings();
			location.reload();
		}
	});
}

if (resetCoursesButton) {
	resetCoursesButton.addEventListener("click", () => {
		resetCourses();
	});
	resetCoursesButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			resetCourses();
		}
	});
}

const settings = await settingsPromise;

if (settingsForm && settings) {
	console.log(settingsForm);
	console.log(settings);
}
