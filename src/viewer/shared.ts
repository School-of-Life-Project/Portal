import { Course, Textbook, setCourseCompletion, CourseCompletionData, Chapter } from "../bindings.ts";

export interface ListingItem {
	label: string,
	identifier?: string,
	subitems?: ListingItem[],
}

export type ListingCallback = (identifier: string) => void;

export class ViewManager {
	titleContainer: HTMLElement;
	listingContainer: HTMLElement;
	contentContainer: HTMLElement;
	#styleContainer: HTMLStyleElement;
	rendered = false;
	constructor (titleContainer: HTMLElement, listingContainer: HTMLElement, contentContainer: HTMLElement) {
		this.titleContainer = titleContainer;
		this.listingContainer = listingContainer;
		this.contentContainer = contentContainer;

		this.#styleContainer = document.createElement("style");
		window.document.head.appendChild(this.#styleContainer);
	}
	render(listing?: ListingItem[], callback?: ListingCallback, title?: string, language?: string) {
		if (language) {
			this.titleContainer.setAttribute("lang", language);
			this.listingContainer.setAttribute("lang", language);
			this.contentContainer.setAttribute("lang", language);
		}

		if (title) {
			this.titleContainer.innerText = title;
		}

		if (listing && callback) {
			this.listingContainer.appendChild(this.#buildListing(listing, callback));
		}

		this.rendered = true;
	};
	reset() {
		this.titleContainer.innerHTML = "";
		this.listingContainer.innerHTML = "";
		this.contentContainer.innerHTML = "";
		this.#styleContainer.innerHTML = "";

		this.titleContainer.removeAttribute("lang");
		this.listingContainer.removeAttribute("lang");
		this.contentContainer.removeAttribute("lang");

		this.rendered = false;
	}
	#buildListingLabel(item: ListingItem, callback: ListingCallback): HTMLAnchorElement | HTMLSpanElement {
		let element;
		if (item.identifier) {
			element = document.createElement("a");
			element.setAttribute("tabindex", "0");
			element.setAttribute("role", "button");
			element.addEventListener("click", (event) => {
				if (item.identifier) {
					callback(item.identifier);
					event.preventDefault();
				}
			});
			element.addEventListener("keydown", (event) => {
				if (event.code == "Enter" && item.identifier) {
					callback(item.identifier);
					event.preventDefault();
				}
			});
			element.setAttribute("id", item.identifier);
		} else {
			element = document.createElement("span");
		}
		element.innerText = item.label;

		return element;
	}
	#buildListing(listing: ListingItem[], callback: ListingCallback): HTMLOListElement {
		const root = document.createElement("ol");

		for (const item of listing) {
			const container = document.createElement("li");
			const label = this.#buildListingLabel(item, callback);

			if (item.subitems) {
				const subcontainer = document.createElement("details");

				const subcontainer_title = document.createElement("summary");
				subcontainer_title.appendChild(label);
				subcontainer.appendChild(subcontainer_title);

				subcontainer.appendChild(this.#buildListing(item.subitems, callback));

				container.appendChild(subcontainer);
			} else {
				container.appendChild(label);
			}

			root.appendChild(container);
		}

		return root;
	}
	highlightListingItem(identifier: string) {
		if (!this.rendered) {
			return;
		}

		this.#styleContainer.innerHTML = "#" + CSS.escape(identifier) + " {font-weight: bold}";

		let currentElement = window.document.getElementById(identifier)?.parentElement?.parentElement;
		while (currentElement && currentElement.parentElement && currentElement.parentElement != this.listingContainer) {
			currentElement = currentElement.parentElement;

			if (currentElement.tagName == "DETAILS") {
				currentElement.setAttribute("open", "");
			}
		}
	}
}

export class ProgressManager {
	#intervalId: number | undefined = undefined;
	#completion: CourseCompletionData | undefined = undefined;
	#completedSections: Set<string> = new Set();
	manager: ViewManager;
	timerContainer: HTMLElement;
	rendered = false;
	constructor (view: ViewManager, timerContainer: HTMLElement) {
		this.manager = view;
		this.timerContainer = timerContainer;
	}
	render(course: [Course, CourseCompletionData], document_index: number) {
		if (!this.manager.rendered) {
			return;
		}

		this.#completion = course[1];
		this.#completedSections = new Set(course[1].book_sections[document_index]);
		this.#buildListingProgressTracker({ course: course[0], progress: this.#completion }, document_index);
		// TODO: build time display
		this.#intervalId = window.setInterval(() => {
			if (this.#completion && this.#completion.time_spent_secs) {
				this.#completion.time_spent_secs += this.#completion?.time_spent_secs + 1;
				setCourseCompletion(course[0].uuid, this.#completion);
			}
		}, 1000);

		this.rendered = true;
	}
	reset() {
		if (this.manager.rendered) {
			return;
		}

		this.#completion = undefined;
		this.#completedSections = new Set();
		if (this.#intervalId) {
			window.clearInterval(this.#intervalId);
			this.#intervalId = undefined;
		}
		this.rendered = false;
	}
	#buildListingProgressTracker(course: { course: Course, progress: CourseCompletionData; }, document_index: number) {
		const textbook = course.course.books[document_index];

		for (const chapter of textbook.chapters) {
			if (chapter.root) {
				const element = document.getElementById(chapter.root);

				if (element && element.parentElement) {
					element.parentElement.appendChild(this.#buildCheckbox(this.#completedSections.has(chapter.root), (event) => {
						if (chapter.root && this.#completion && event.target) {
							if ((<HTMLInputElement>event.target).checked) {
								this.#completedSections.add(chapter.root);
							} else {
								this.#completedSections.delete(chapter.root);
							}
							this.#completion.book_sections[document_index] = Array.from(this.#completedSections);
							this.#showNextChapter(textbook, chapter.root);
						}
					}));
				}
			}
			this.#buildSectionProgressTracker(textbook, chapter, document_index);
		}

		this.#showNextChapter(textbook, undefined, true);
	}
	#buildSectionProgressTracker(textbook: Textbook, chapter: Chapter, document_index: number) {
		for (const sectionGroup of chapter.sections) {
			for (const section of sectionGroup) {
				const element = document.getElementById(section);

				if (element && element.parentElement) {
					element.parentElement.appendChild(this.#buildCheckbox(this.#completedSections.has(section), (event) => {
						if (this.#completion && event.target) {
							if ((<HTMLInputElement>event.target).checked) {
								this.#completedSections.add(section);
							} else {
								this.#completedSections.delete(section);
							}
							this.#completion.book_sections[document_index] = Array.from(this.#completedSections);
							this.#updateChapterCompletion(textbook, chapter, (<HTMLInputElement>event.target).checked);
						}
					}));
				}
			}
		}
	}
	#buildCheckbox(checked: boolean, listener: (event: Event) => void) {
		const checkbox = document.createElement("input");
		checkbox.setAttribute("type", "checkbox");

		if (checked) {
			checkbox.setAttribute("checked", "");
		}
		checkbox.addEventListener("change", listener);

		return checkbox;
	}
	#updateChapterCompletion(textbook: Textbook, chapter: Chapter, checked: boolean) {
		// TODO

		this.#showNextChapter(textbook);
	}
	#showNextChapter(textbook: Textbook, chapterId?: string, autoscroll = false) {
		// TODO
	}
}

export interface DocumentViewer {
	new(course: Course, document_index: number, initialProgress: CourseCompletionData): Promise<DocumentViewer>;
	render(view: ViewManager, progress: ProgressManager): Promise<null>;
	destroy(): Promise<null>;
}