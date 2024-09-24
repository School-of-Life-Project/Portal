import { Course, CourseCompletionData } from "../bindings.ts";
import { ListingItem, ViewManager, DocumentViewer } from "./shared.ts";
import Epub, { Book, EpubCFI } from "epubjs";
import { NavItem } from "epubjs/types/navigation";

// Based on https://github.com/futurepress/epub.js/issues/1084#issuecomment-647002309

const resolveURL = (url: string, relativeTo: string) => {
	// HACK-ish: abuse the URL API a little to resolve the path
	// the base needs to be a valid URL, or it will throw a TypeError,
	// so we just set a random base URI and remove it later
	const base = "https://example.invalid/";
	return new URL(url, base + relativeTo).href.replace(base, "");
};

function resolveNavUrl(book: Book, href: string) {
	const basePath = book.packaging.navPath || book.packaging.ncxPath;
	return resolveURL(href, basePath);
}

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
				.canonical(resolveNavUrl(book, chapter.href))
				.includes(book.canonical(locationHref));
		}, null)
		.reduce((result: NavItem | null, chapter) => {
			const locationAfterChapter =
				EpubCFI.prototype.compare(
					location_cfi,
					getCfiFromHref(book, resolveNavUrl(book, chapter.href)),
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

function convertNavItems(book: Book, items: NavItem[]): ListingItem[] {
	const convertedItems: ListingItem[] = [];

	for (const item of items) {
		let subitems: ListingItem[] | undefined = undefined;

		if (item.subitems && item.subitems.length > 0) {
			subitems = convertNavItems(book, item.subitems);
		}

		let identifier;
		if (item.href) {
			identifier = resolveNavUrl(book, item.href);

			if (identifier.startsWith("./")) {
				identifier = identifier.substring(2);
			}
		}

		convertedItems.push({
			label: item.label.trim(),
			identifier,
			subitems,
		});
	}

	return convertedItems;
}

interface PositionData {
	root: string;
	sections: Record<string, string>;
}

interface InnerData {
	book: Book;
	resizeObserver?: ResizeObserver;
}

export class ePubViewer implements DocumentViewer {
	course: Course;
	document_index: number;
	rendered: boolean;
	#inner: InnerData | undefined = undefined;
	constructor(course: Course, document_index: number) {
		this.course = course;
		this.document_index = document_index;

		this.rendered = false;
	}
	async render(
		view: ViewManager,
		initialProgress: CourseCompletionData,
	): Promise<null | void> {
		const path = this.course.books[this.document_index].file;

		return Epub(path, { openAs: "directory" }).opened.then((book: Book) => {
			return Promise.all([book.loaded.metadata, book.loaded.navigation]).then(
				([metadata, navigation]) => {
					this.#inner = {
						book,
					};

					// @ts-expect-error RenditionOptions type is incomplete
					const rendition = this.#inner.book.renderTo(view.container.content, {
						view: "iframe",
						flow: "scrolled-doc",
						width: "100%",
						height: "100%",
						spread: "none",
						allowPopups: true,
						allowScriptedContent: true,
					});

					rendition.themes.font("Times New Roman, Liberation Serif, serif");
					rendition.themes.fontSize("18px");
					rendition.themes.override("line-height", "1.5");

					let position = initialProgress.books[this.document_index]?.position;

					let positionData: PositionData | undefined;

					if (position) {
						if (position.startsWith("epubcfi")) {
							positionData = {
								root: position,
								sections: {},
							};
						} else {
							positionData = JSON.parse(position) as PositionData;
							position = positionData.root;
						}
					} else {
						positionData = { root: "", sections: {} };
						position = resolveNavUrl(book, book.navigation.toc[0].href);
					}

					const renderPromise = new Promise(
						(resolve: (value: void) => void) => {
							view.render(
								{
									course: this.course,
									completion: initialProgress,
									document_index: this.document_index,
								},
								{
									title: metadata.title.trim(),
									language: metadata.language,
									items: convertNavItems(book, navigation.toc),
									callback: (identifier) => {
										if (positionData.sections[identifier]) {
											rendition.display(positionData.sections[identifier]);
										} else {
											rendition.display(identifier);
										}
									},
								},
							);

							resolve();
						},
					);

					return rendition.display(position).then(() => {
						rendition.on("locationChanged", (location: EventLocation) => {
							if (location.start) {
								if (location.href) {
									const chapter = getChapter(book, {
										location_href: location.href,
										location_cfi: location.start,
									});

									if (chapter && chapter.href) {
										// ! FIXME

										// view.highlightListingItem(
										// 	resolveNavUrl(book, chapter.href),
										// );

										view.highlightListingItem(chapter.href);
									}

									if (view.savePosition) {
										positionData.root = location.start;
										positionData.sections[location.href] = location.start;

										view.savePosition(JSON.stringify(positionData));
									}
								}
							}

							// Workaround for https://github.com/tauri-apps/tauri/issues/9912, copied from Tauri user scripts
							view.container.content
								.querySelector("iframe")
								?.contentDocument?.body.addEventListener("click", (t) => {
									let n = t.target as HTMLElement | null;
									for (; null != n; ) {
										if (n.matches("a")) {
											const r = n as HTMLAnchorElement;
											// eslint-disable-next-line @typescript-eslint/no-unused-expressions
											"" !== r.href &&
												["http://", "https://", "mailto:", "tel:"].some((e) =>
													r.href.startsWith(e),
												) &&
												"_blank" === r.target &&
												// @ts-expect-error accessing Tauri internals
												(window.parent.__TAURI_INTERNALS__.invoke(
													"plugin:shell|open",
													{
														path: r.href,
													},
												),
												t.preventDefault());
											break;
										}
										n = n.parentElement;
									}
								});
						});

						if (this.#inner) {
							this.#inner.resizeObserver = new ResizeObserver((_event) => {
								// @ts-expect-error need to call rendition.resize() with zero arguments to resize without providing a specific length and height
								rendition.resize();
							});
							this.#inner.resizeObserver.observe(view.container.content);
						}

						this.rendered = true;

						return renderPromise;
					});
				},
			);
		});
	}
}
