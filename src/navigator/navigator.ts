import {
	CourseMap,
	displayError,
	getActiveCourses,
	getAll,
	openDataDir,
} from "../bindings.ts";
import { buildCourseListing } from "./courses.ts";

const listingPromise = getAll().catch((error) => {
	displayError(error);
});

const activePromise = getActiveCourses().catch((error) => {
	displayError(error);
});

const folderButton = document.getElementById("folderOpener");
const refreshButton = document.getElementById("refreshButton");
const contentListing = document.getElementById("listingInner");

function openFolder() {
	openDataDir().catch((error) => {
		displayError(error);
	});
}

if (folderButton) {
	folderButton.addEventListener("click", openFolder);
	folderButton.addEventListener("keydown", openFolder);
}

if (refreshButton) {
	refreshButton.addEventListener("click", () => {
		location.reload();
	});
	refreshButton.addEventListener("keydown", () => {
		location.reload();
	});
}

if (contentListing) {
	listingPromise.then(async (listing) => {
		if (!listing) {
			return;
		}

		const fragment = document.createDocumentFragment();

		if (listing.course_maps.length != 0 && listing.courses.length != 0) {
			fragment.appendChild(buildCourseMapListing(listing.course_maps));
		}

		const activeCourses = await activePromise;
		if (activeCourses) {
			fragment.appendChild(
				buildCourseListing(listing.courses, new Set(activeCourses)),
			);
		}

		contentListing.innerHTML = "";
		contentListing.appendChild(fragment);
	});
}

function buildCourseMapListing(
	courseMaps: [CourseMap, string][],
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	const header = document.createElement("h2");
	header.innerText = "Your Course Maps";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	for (const [courseMap, _] of courseMaps) {
		const element = document.createElement("li");
		element.innerText = courseMap.title;

		list.appendChild(element);
	}

	fragment.appendChild(list);

	if (courseMaps.length != 0) {
		fragment.appendChild(document.createElement("br"));
	}

	return fragment;
}
