import { RefProxy } from "pdfjs-dist/types/src/display/api";
import { Course, CourseCompletionData } from "../bindings.ts";
import {
	ListingItem,
	ViewManager,
	ProgressManager,
	DocumentViewer,
} from "./shared.ts";
import {
	getDocument,
	GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import {
	EventBus,
	PDFLinkService,
	PDFScriptingManager,
	PDFViewer as BasicPDFViewer,
} from "pdfjs-dist/legacy/web/pdf_viewer.mjs";

GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/legacy/build/pdf.worker.mjs",
	import.meta.url,
).href;

const container = document.createElement("div");
const innerContainer = document.createElement("div");
innerContainer.setAttribute("id", "viewer");
innerContainer.setAttribute("class", "pdfViewer");
container.appendChild(innerContainer);

const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const scriptingManager = new PDFScriptingManager({
	eventBus,
	sandboxBundleSrc: new URL(
		"pdfjs-dist/legacy/build/pdf.sandbox.mjs",
		import.meta.url,
	).href,
});
const pdfViewer = new BasicPDFViewer({
	container,
	eventBus,
	linkService,
	scriptingManager,
});
linkService.setViewer(pdfViewer);
scriptingManager.setViewer(pdfViewer);

eventBus.on("pagesinit", () => {
	pdfViewer.currentScaleValue = "page-width";
});
const resizeObserver = new ResizeObserver((_event) => {
	if (pdfViewer.pdfDocument) {
		pdfViewer.currentScaleValue = "page-width";
		pdfViewer.update();
	}
});
resizeObserver.observe(container);

type Dest = string | RefProxy[] | null;
interface OutlineItem {
	title: string;
	dest: Dest;
	items: OutlineItem[];
}

interface CommonMetadata {
	Title: string;
	Language: string;
}

function convertOutlineItems(items: OutlineItem[]): ListingItem[] {
	const convertedItems: ListingItem[] = [];

	for (const item of items) {
		let subitems: ListingItem[] | undefined = undefined;

		if (item.items && item.items.length > 0) {
			subitems = convertOutlineItems(item.items);
		}

		convertedItems.push({
			label: item.title,
			identifier: JSON.stringify(item.dest),
			subitems,
		});
	}

	return convertedItems;
}

async function displayDest(dest: Dest) {
	const document = pdfViewer.pdfDocument;

	if (!document) {
		return Promise.resolve();
	}

	if (typeof dest === "string") {
		const destArray = await document.getDestination(dest);
		if (destArray) {
			return document.getPageIndex(destArray[0]).then((pageNumber) => {
				pdfViewer.scrollPageIntoView({
					pageNumber: pageNumber + 1,
					destArray,
				});
			});
		}
	} else if (typeof dest === "object" && Array.isArray(dest)) {
		const pageNumber_1 = await document.getPageIndex(dest[0]);
		pdfViewer.scrollPageIntoView({
			pageNumber: pageNumber_1 + 1,
			destArray: dest as RefProxy[],
		});
	} else {
		return Promise.resolve();
	}
}

export class PDFViewer implements DocumentViewer {
	course: Course;
	document_index: number;
	rendered: boolean;
	destroyed: boolean;
	constructor(course: Course, document_index: number) {
		this.course = course;
		this.document_index = document_index;

		this.rendered = false;
		this.destroyed = false;
	}
	render(
		view: ViewManager,
		progress: ProgressManager,
		initialProgress: CourseCompletionData,
	): Promise<null | void> {
		return getDocument({
			url: this.course.books[this.document_index].file,
			cMapUrl: "cmaps/",
			cMapPacked: true,
			enableXfa: true,
		}).promise.then((document) => {
			return Promise.all([document.getMetadata(), document.getOutline()]).then(
				([metadata, outline]) => {
					view.contentContainer.appendChild(container);

					pdfViewer.setDocument(document);
					linkService.setDocument(document, null);

					view.render(
						convertOutlineItems(outline),
						(destString) => {
							displayDest(JSON.parse(destString));
						},
						(<CommonMetadata>metadata.info).Title,
						(<CommonMetadata>metadata.info).Language,
					);

					progress.render([this.course, initialProgress], this.document_index);
				},
			);
		});
	}
	destroy(view: ViewManager, progress: ProgressManager): Promise<null | void> {
		// @ts-expect-error setting the pdfViewer document to null is necessary to reset it
		pdfViewer.setDocument(null);
		linkService.setDocument(null);

		view.contentContainer.removeChild(container);

		view.reset();
		progress.reset();

		return Promise.resolve();
	}
}
