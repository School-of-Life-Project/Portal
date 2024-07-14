import {
	displayError,
	getCourseMaps,
	getCourses,
	getSettings,
	openDataDir,
} from "../bindings.ts";

const settingsPromise = getSettings().catch((error) => {
	displayError({
		message: "Unable to get Settings",
		cause: JSON.stringify(error),
	});
});

const coursePromise = getCourses().catch((error) => {
	displayError({
		message: "Unable to get Courses",
		cause: JSON.stringify(error),
	});
});

const courseMapPromise = getCourseMaps().catch((error) => {
	displayError({
		message: "Unable to get Course Maps",
		cause: JSON.stringify(error),
	});
});

const folderButton = document.getElementById("folderOpener");

function openFolder() {
	openDataDir().catch((error) => {
		displayError({
			message: "Unable to open Data folder",
			cause: JSON.stringify(error),
		});
	});
}

if (folderButton) {
	folderButton.addEventListener("click", openFolder);
	folderButton.addEventListener("keydown", openFolder);
}

const settings = await settingsPromise;
const courses = await coursePromise;
const courseMaps = await courseMapPromise;

console.log("settings", settings);
console.log("courses", courses);
console.log("course maps", courseMaps);
