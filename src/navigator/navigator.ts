import {
	Course,
	CourseMap,
	CourseProgress,
	displayError,
	getActiveCourses,
	getAll,
	openDataDir,
} from "../bindings.ts";

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

		console.log("listing", listing);

		console.log("active", activeCourses);
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

function buildCourseListing(
	courses: [Course, CourseProgress][],
	active: Set<string>,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	if (courses.length == 0) {
		const header = document.createElement("h2");
		header.innerText = "No courses found!";

		fragment.appendChild(header);

		const message = document.createElement("span");
		message.innerText =
			"Try importing some courses into the resource folder, and then refreshing the navigator.";

		fragment.appendChild(message);

		return fragment;
	}

	const header = document.createElement("h2");
	header.innerText = "Your Courses";

	fragment.appendChild(header);

	const list = document.createElement("ul");

	for (const [course, _courseProgress] of courses) {
		const element = document.createElement("li");
		element.id = "course-" + course.uuid;

		const label = document.createElement("span");
		label.innerText = course.title;
		element.appendChild(label);

		const checkbox = document.createElement("input");
		checkbox.setAttribute("type", "checkbox");
		if (active.has(course.uuid)) {
			checkbox.checked = true;
		}
		element.appendChild(checkbox);

		list.appendChild(element);
	}

	fragment.appendChild(list);

	return fragment;
}
