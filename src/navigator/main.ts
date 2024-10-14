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
const styleContainer = document.createElement("style");
window.document.head.appendChild(styleContainer);

function openFolder() {
	openDataDir().catch((error) => {
		displayError(error);
	});
}

if (folderButton) {
	folderButton.addEventListener("click", () => {
		openFolder();
	});
}

if (refreshButton) {
	refreshButton.addEventListener("click", () => {
		location.reload();
	});
}

if (contentListing && contentViewer) {
	Promise.all([listingPromise, activePromise]).then(
		async ([listing, activeCourses]) => {
			if (!listing || !activeCourses) {
				return;
			}

			console.log(listing);

			const [courseListing, courseMapping] = buildCourseListing(
				listing.courses,
				new Set(activeCourses),
				contentViewer,
				styleContainer,
			);

			const fragment = document.createDocumentFragment();

			if (listing.course_maps.length > 0 && listing.courses.length > 0) {
				fragment.appendChild(
					buildCourseMapListing(
						courseMapping,
						listing.course_maps,
						contentViewer,
						styleContainer,
					),
				);
			}

			fragment.appendChild(courseListing);

			contentListing.innerHTML = "";
			contentListing.appendChild(fragment);
		},
	);
}
