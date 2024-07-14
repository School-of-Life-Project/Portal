import { Course, CourseCompletionData } from "../bindings.ts";
import {
	ListingItem,
	ViewManager,
	ProgressManager,
	DocumentViewer,
} from "./shared.ts";
import Epub, { Book, EpubCFI } from "epubjs";
import { NavItem } from "epubjs/types/navigation";

// Based on https://github.com/futurepress/epub.js/issues/759#issuecomment-1399499918
function flatten(chapters: NavItem[]): NavItem[] {
	return (<NavItem[]>[]).concat.apply(
		[],
		chapters.map((chapter) =>
			(<NavItem[]>[]).concat.apply([chapter], flatten(chapter.subitems || [])),
		),
	);
}

// Based on https://github.com/futurepress/epub.js/issues/759#issuecomment-1399499918
function getCfiFromHref(book: Book, href: string) {
	const [_, id] = href.split("#");
	const section = book.spine.get(href);
	const el = id ? section.document.getElementById(id) : section.document.body;
	if (el) {
		return section.cfiFromElement(el);
	} else {
		return "";
	}
}

// Based on https://github.com/futurepress/epub.js/issues/759#issuecomment-1399499918
function getChapter(
	book: Book,
	{
		location_href,
		location_cfi,
	}: { location_href: string; location_cfi: string },
) {
	const locationHref = location_href;

	const match: NavItem | null = flatten(book.navigation.toc)
		.filter((chapter) => {
			return book
				.canonical(chapter.href)
				.includes(book.canonical(locationHref));
		}, null)
		.reduce((result: NavItem | null, chapter) => {
			const locationAfterChapter =
				EpubCFI.prototype.compare(
					location_cfi,
					getCfiFromHref(book, chapter.href),
				) > 0;
			return locationAfterChapter ? chapter : result;
		}, null);

	return match;
}

interface EventLocation {
	index: number;
	href: string;
	start: string;
	end: string;
	percentage: number;
}

function convertNavItems(items: NavItem[]): ListingItem[] {
	const convertedItems: ListingItem[] = [];

	for (const item of items) {
		let subitems: ListingItem[] | undefined = undefined;

		if (item.subitems && item.subitems.length > 0) {
			subitems = convertNavItems(item.subitems);
		}

		convertedItems.push({
			label: item.label,
			identifier: item.href,
			subitems,
		});
	}

	return convertedItems;
}

interface InnerData {
	book: Book;
	resizeObserver?: ResizeObserver;
}

export class ePubViewer implements DocumentViewer {
	course: Course;
	document_index: number;
	rendered: boolean;
	destroyed: boolean;
	#inner: InnerData | undefined = undefined;
	constructor(course: Course, document_index: number) {
		this.course = course;
		this.document_index = document_index;

		this.rendered = false;
		this.destroyed = false;
	}
	async render(
		view: ViewManager,
		progress: ProgressManager,
		initialProgress: CourseCompletionData,
	): Promise<null | void> {
		const path = this.course.books[this.document_index].file;

		return Epub(path, { openAs: "directory" }).opened.then((book: Book) => {
			return Promise.all([book.loaded.metadata, book.loaded.navigation]).then(
				([metadata, navigation]) => {
					this.#inner = {
						book,
					};

					const rendition = this.#inner.book.renderTo(view.contentContainer, {
						view: "iframe",
						flow: "scrolled-doc",
						width: "100%",
						height: "100%",
						spread: "none",
						allowScriptedContent: true,
					});

					const renderPromise = new Promise(
						(resolve: (value: void) => void) => {
							view.render(
								convertNavItems(navigation.toc),
								(identifier) => {
									rendition.display(identifier);
								},
								metadata.title,
								metadata.language,
							);
							progress.render(
								[this.course, initialProgress],
								this.document_index,
							);

							resolve();
						},
					);

					return rendition
						.display(initialProgress.position[this.document_index])
						.then(() => {
							rendition.on("locationChanged", (location: EventLocation) => {
								if (location.start) {
									if (location.href) {
										const chapter = getChapter(book, {
											location_href: location.href,
											location_cfi: location.start,
										});

										if (chapter) {
											view.highlightListingItem(chapter.id);
										}

										progress.savePosition(this.document_index, location.start);
									}
								}
							});

							if (this.#inner) {
								this.#inner.resizeObserver = new ResizeObserver((_event) => {
									// @ts-expect-error need to call rendition.resize() with zero arguments to resize without providing a specific length and height
									rendition.resize();
								});
								this.#inner.resizeObserver.observe(view.contentContainer);
							}

							this.rendered = true;

							return renderPromise;
						});
				},
			);
		});
	}
	async destroy(
		view: ViewManager,
		progress: ProgressManager,
	): Promise<null | void> {
		this.#inner?.book.destroy();
		this.#inner?.resizeObserver?.unobserve(view.contentContainer);

		view.reset();
		progress.reset();

		this.rendered = false;
		this.destroyed = true;
	}
}
