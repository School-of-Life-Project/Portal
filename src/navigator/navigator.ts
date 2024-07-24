import {
	displayError,
	getActiveCourses,
	getAll,
	getSettings,
	openDataDir,
} from "../bindings.ts";

const settingsPromise = getSettings().catch((error) => {
	displayError(error);
});

const listingPromise = getAll().catch((error) => {
	displayError(error);
});

const activePromise = getActiveCourses().catch((error) => {
	displayError(error);
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
const listing = await listingPromise;
const activeCourses = await activePromise;

console.log("settings", settings);
console.log("listing", listing);
console.log("active", activeCourses);
