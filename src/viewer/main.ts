import { displayError, Error, getCourse } from "../bindings.ts";
import { DocumentViewer, ProgressManager, ViewManager } from "./shared.ts";

let viewer: DocumentViewer | null;

const titleContainer = document.getElementById("contentTitle");
const listingContainer = document.getElementById("contentListing");
const contentContainer = document.getElementById("contentViewer");
const timerContainer = document.getElementById("contentTimer");

const params = new URLSearchParams(window.location.search);
const identifier = params.get("uuid");
let document_index = params.get("document_index");

if (!document_index) {
	document_index = "0";
}

if (titleContainer && listingContainer && contentContainer && timerContainer) {
	const viewManager = new ViewManager(
		titleContainer,
		listingContainer,
		<HTMLDivElement>contentContainer,
	);
	const progressManager = new ProgressManager(viewManager, timerContainer);

	if (identifier) {
		const index = parseInt(document_index);

		if (!Number.isNaN(index)) {
			loadCourse(viewManager, progressManager, identifier, index);
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
} else {
	displayError({
		message: "Unable to initalize document viewer",
		cause: "Could not find HTMLElement",
	});
}

async function loadCourse(
	view: ViewManager,
	progress: ProgressManager,
	uuid: string,
	document_index: number,
) {
	if (viewer) {
		await viewer.destroy(view, progress).then(() => {
			viewer = null;
		});
	}

	view.titleContainer.innerText = "Loading Course...";

	getCourse(uuid)
		.then(async (result) => {
			let viewer: DocumentViewer;

			view.titleContainer.innerText = "Loading Viewer..";

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

			view.titleContainer.innerText = "Loading Book..";

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
