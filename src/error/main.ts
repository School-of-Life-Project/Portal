import {
	displayError,
	openDataDir,
	openInternalDataDir,
	setActiveCourses,
	setSettings,
	Settings,
} from "../bindings.ts";

const params = new URLSearchParams(window.location.search);
const message = params.get("message");
const cause = params.get("cause");

if (message) {
	const messageLabel = document.getElementById("message");

	if (messageLabel) {
		messageLabel.innerText = message;
	}
}

if (cause) {
	const causeLabel = document.getElementById("cause");

	if (causeLabel) {
		causeLabel.innerText = cause;
	}
}

const resetCoursesButton = document.getElementById("resetCoursesButton");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const resourceButton = document.getElementById("resourceButton");
const internalFolderButton = document.getElementById("internalFolderButton");

async function updateSettings(settings?: Settings) {
	return setSettings(settings).catch((error) => {
		displayError(error);
	});
}

async function resetCourses() {
	return setActiveCourses([]).catch((error) => {
		displayError(error);
	});
}

if (resetSettingsButton) {
	resetSettingsButton.addEventListener("click", () => {
		updateSettings().then(() => location.reload());
	});
}

if (resetCoursesButton) {
	resetCoursesButton.addEventListener("click", () => {
		resetCourses().then(() => location.reload());
	});
}

if (resourceButton) {
	resourceButton.addEventListener("click", () => {
		openDataDir().catch((error) => {
			displayError(error);
		});
	});
}

if (internalFolderButton) {
	internalFolderButton.addEventListener("click", () => {
		openInternalDataDir().catch((error) => {
			displayError(error);
		});
	});
}
