import {
	openDataDir,
	openInternalDataDir,
	openIssueTracker,
	openRepo,
	setActiveCourses,
	setSettings,
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

function resetSettings() {
	setSettings();
}

function resetActiveCourses() {
	setActiveCourses([]);
}

// @ts-expect-error global
window.openDataDir = openDataDir;
// @ts-expect-error global
window.openInternalDataDir = openInternalDataDir;
// @ts-expect-error global
window.openRepo = openRepo;
// @ts-expect-error global
window.openIssueTracker = openIssueTracker;
// @ts-expect-error global
window.resetSettings = resetSettings;
// @ts-expect-error global
window.resetActiveCourses = resetActiveCourses;
