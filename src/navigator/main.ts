import {
	applyTheme,
	displayError,
	getActiveCourses,
	getAll,
	getSettings,
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

const settingsPromise = getSettings().catch((error) => {
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
	Promise.all([listingPromise, activePromise, settingsPromise]).then(
		async ([listing, activeCourses, settings]) => {
			if (!listing || !activeCourses || !settings) {
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
						settings,
					),
				);
			}

			fragment.appendChild(courseListing);

			contentListing.innerHTML = "";
			contentListing.appendChild(fragment);

			applyTheme(settings);
		},
	);
}
