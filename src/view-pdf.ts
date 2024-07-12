import { displayError, Error, getCourse } from "./bindings.ts";
import { PDFViewer } from "./viewer/pdf";
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
		"164e0270-a987-4234-85a5-66180b735a43",
	);
}

function loadCourse(
	view: ViewManager,
	progress: ProgressManager,
	uuid: string,
) {
	if (viewer) {
		viewer.destroy(view, progress);
		viewer = null;
	} else {
		return getCourse(uuid)
			.then((result) => {
				viewer = new PDFViewer(result[0], 0);
				viewer.render(view, progress, result[1]).catch((error) => {
					displayError({
						message: "Unable to display document",
						cause: JSON.stringify(error),
					});
				});
			})
			.catch((error: Error) => {
				displayError(error);
			});
	}
}
