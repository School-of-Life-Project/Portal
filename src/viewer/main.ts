import {
	Course,
	CourseCompletionData,
	displayError,
	Error,
	getCourse,
	getSettings,
} from "../bindings.ts";
import { DocumentViewer, ProgressManager, ViewManager } from "./shared.ts";

const settingsPromise = getSettings().catch((error) => {
	displayError({
		message: "Unable to get Settings",
		cause: JSON.stringify(error),
	});
});

const params = new URLSearchParams(window.location.search);
const identifier = params.get("uuid");
let raw_document_index = params.get("document_index");

if (!raw_document_index) {
	raw_document_index = "0";
}

const document_index = parseInt(raw_document_index);

let coursePromise: Promise<void | [Course, CourseCompletionData]> | undefined;

if (identifier) {
	if (!Number.isNaN(document_index)) {
		coursePromise = getCourse(identifier).catch((error: Error) => {
			displayError(error);
		});
	} else {
		displayError({
			message: "Unable to initalize document viewer",
			cause: "Could not parse document_index",
		});
	}
} else {
	displayError({
		message: "Unable to initalize document viewer",
		cause: "Course UUID was not specified",
	});
}

let viewer: DocumentViewer | undefined;

const titleContainer = document.getElementById("contentTitle");
const listingContainer = document.getElementById("contentListing");
const contentContainer = document.getElementById("contentViewer");
const timerContainer = document.getElementById("contentTimer");

const settings = await settingsPromise;

if (
	titleContainer &&
	listingContainer &&
	contentContainer &&
	timerContainer &&
	settings &&
	coursePromise
) {
	const viewManager = new ViewManager(
		titleContainer,
		listingContainer,
		<HTMLDivElement>contentContainer,
	);

	const progressManager = new ProgressManager(
		viewManager,
		timerContainer,
		settings,
	);

	loadCourse(viewManager, progressManager, coursePromise, document_index);
} else if (settings && coursePromise) {
	displayError({
		message: "Unable to initalize document viewer",
		cause: "Could not find HTMLElement",
	});
}

async function loadCourse(
	view: ViewManager,
	progress: ProgressManager,
	coursePromise: Promise<void | [Course, CourseCompletionData]>,
	document_index: number,
) {
	if (viewer) {
		await viewer.destroy(view, progress).then(() => {
			viewer = undefined;
		});
	}

	coursePromise
		.then(async (result) => {
			if (!result) {
				return;
			}

			let viewer: DocumentViewer;

			if (result[0].books[document_index].file.endsWith(".pdf")) {
				try {
					const module = await import("./pdf.ts");
					viewer = new module.PDFViewer(result[0], document_index);
				} catch (error) {
					displayError({
						message: "Unable to load DocumentViewer",
						cause: JSON.stringify(error),
					});
					return;
				}
			} else {
				try {
					const module = await import("./epub.ts");
					viewer = new module.ePubViewer(result[0], document_index);
				} catch (error) {
					displayError({
						message: "Unable to load DocumentViewer",
						cause: JSON.stringify(error),
					});
					return;
				}
			}

			try {
				return await viewer.render(view, progress, result[1]);
			} catch (error) {
				displayError({
					message: "Unable to display document",
					cause: JSON.stringify(error),
				});
			}
		})
		.catch((error: Error) => {
			displayError(error);
		});
}
