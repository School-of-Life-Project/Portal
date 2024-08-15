import {
	displayError,
	getActiveCourses,
	getAll,
	openDataDir,
} from "../bindings.ts";
import { buildCourseListing } from "./courses.ts";
import { buildCourseMapListing } from "./maps.ts";

const listingPromise = getAll().catch((error) => {
	displayError(error);
});

const activePromise = getActiveCourses().catch((error) => {
	displayError(error);
});

const folderButton = document.getElementById("folderOpener");
const refreshButton = document.getElementById("refreshButton");
const contentListing = document.getElementById("listingInner");
const contentViewer = document.getElementById("contentViewer");

function openFolder() {
	openDataDir().catch((error) => {
		displayError(error);
	});
}

if (folderButton) {
	folderButton.addEventListener("click", () => {
		openFolder();
	});
	folderButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			openFolder();
		}
	});
}

if (refreshButton) {
	refreshButton.addEventListener("click", () => {
		location.reload();
	});
	refreshButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			location.reload();
		}
	});
}

if (contentListing && contentViewer) {
	listingPromise.then(async (listing) => {
		if (!listing) {
			return;
		}

		const fragment = document.createDocumentFragment();

		if (listing.course_maps.length > 0 && listing.courses.length > 0) {
			fragment.appendChild(
				buildCourseMapListing(listing.course_maps, contentViewer),
			);
		}

		const activeCourses = await activePromise;
		if (activeCourses) {
			fragment.appendChild(
				buildCourseListing(
					listing.courses,
					new Set(activeCourses),
					contentViewer,
				),
			);
		}

		contentListing.innerHTML = "";
		contentListing.appendChild(fragment);
	});
}
