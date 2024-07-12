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
	PDFViewer as BasicPDFViewer,
} from "pdfjs-dist/legacy/web/pdf_viewer.mjs";

GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/legacy/build/pdf.worker.mjs",
	import.meta.url,
).href;

let pdfViewer: BasicPDFViewer | undefined;

function initalizePdfViewer(container: HTMLDivElement): BasicPDFViewer {
	const eventBus = new EventBus();
	const pdfViewer = new BasicPDFViewer({
		container,
		eventBus,
	});

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

	return pdfViewer;
}

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
	if (!pdfViewer) {
		return;
	}

	const document = pdfViewer.pdfDocument;

	if (!document) {
		return Promise.resolve();
	}

	if (typeof dest === "string") {
		const destArray = await document.getDestination(dest);
		if (destArray) {
			return document.getPageIndex(destArray[0]).then((pageNumber) => {
				if (!pdfViewer) {
					return;
				}

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
		const innerContainer = document.createElement("div");
		innerContainer.id = "viewer";
		innerContainer.classList.add("pdfViewer");
		view.contentContainer.appendChild(innerContainer);

		return getDocument({
			url: this.course.books[this.document_index].file,
		}).promise.then((document) => {
			return Promise.all([document.getMetadata(), document.getOutline()]).then(
				([metadata, outline]) => {
					if (!pdfViewer) {
						pdfViewer = initalizePdfViewer(
							<HTMLDivElement>view.contentContainer,
						);
					}

					view.render(
						convertOutlineItems(outline),
						(destString) => {
							displayDest(JSON.parse(destString));
						},
						(<CommonMetadata>metadata.info).Title,
						(<CommonMetadata>metadata.info).Language,
					);

					progress.render([this.course, initialProgress], this.document_index);

					pdfViewer.setDocument(document);

					this.rendered = true;
				},
			);
		});
	}
	destroy(view: ViewManager, progress: ProgressManager): Promise<null | void> {
		if (pdfViewer) {
			// @ts-expect-error setting the pdfViewer document to null is necessary to reset it
			pdfViewer.setDocument(null);
		}

		view.reset();
		progress.reset();

		this.rendered = false;
		this.destroyed = true;

		return Promise.resolve();
	}
}
