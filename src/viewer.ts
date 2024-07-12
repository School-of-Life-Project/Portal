import { displayError, Error, getCourse } from "./bindings.ts";
import {
	DocumentViewer,
	ProgressManager,
	ViewManager,
} from "./viewer/shared.ts";

let viewer: DocumentViewer | null;

const titleContainer = document.getElementById("contentTitle");
const listingContainer = document.getElementById("contentListing");
const contentContainer = document.getElementById("contentViewer");
const timerContainer = document.getElementById("contentTimer");

if (titleContainer && listingContainer && contentContainer && timerContainer) {
	const viewManager = new ViewManager(
		titleContainer,
		listingContainer,
		contentContainer,
	);
	const progressManager = new ProgressManager(viewManager, timerContainer);

	loadCourse(
		viewManager,
		progressManager,
		"495da27d107745d5b68d171919bffe9c",
		0,
	);
}

// PDF: 164e0270-a987-4234-85a5-66180b735a43
// ePUB: 495da27d107745d5b68d171919bffe9c

function loadCourse(
	view: ViewManager,
	progress: ProgressManager,
	uuid: string,
	document_index: number,
) {
	if (viewer) {
		viewer.destroy(view, progress);
		viewer = null;
	} else {
		return getCourse(uuid)
			.then((result) => {
				if (result[0].books[document_index].file.endsWith(".pdf")) {
					return import("./viewer/pdf.ts").then((module) => {
						viewer = new module.PDFViewer(result[0], document_index);
						return viewer.render(view, progress, result[1]).catch((error) => {
							displayError({
								message: "Unable to display document",
								cause: JSON.stringify(error),
							});
						});
					});
				} else {
					return import("./viewer/epub.ts").then((module) => {
						viewer = new module.ePubViewer(result[0], document_index);
						return viewer.render(view, progress, result[1]).catch((error) => {
							displayError({
								message: "Unable to display document",
								cause: JSON.stringify(error),
							});
						});
					});
				}
			})
			.catch((error: Error) => {
				displayError(error);
			});
	}
}
