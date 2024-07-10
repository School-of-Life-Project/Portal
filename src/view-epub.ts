import { getCourse } from "./bindings.ts";
import { ePubViewer } from "./viewer/epub";
import { DocumentViewer, ProgressManager, ViewManager } from "./viewer/shared.ts";

let viewer: DocumentViewer | null;

let titleContainer = document.getElementById("contentTitle");
let listingContainer = document.getElementById("contentListing");
let contentContainer = document.getElementById("contentViewer");
let timerContainer = document.getElementById("contentTimer");

if (titleContainer && listingContainer && contentContainer && timerContainer) {
	let viewManager = new ViewManager(titleContainer, listingContainer, contentContainer);
	let progressManager = new ProgressManager(viewManager, timerContainer);

	loadCourse(viewManager, progressManager, "495da27d107745d5b68d171919bffe9c");
}

function loadCourse(view: ViewManager, progress: ProgressManager, uuid: string) {
	if (viewer) {
		viewer.destroy(view, progress);
		viewer = null;
	} else {
		return getCourse(uuid).then((result) => {
			if (Array.isArray(result)) {
				viewer = new ePubViewer(result[0], 0);
				viewer.render(view, progress, result[1]);
			}
		});
	}
}