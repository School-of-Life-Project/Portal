import {
	Course,
	Textbook,
	setCourseCompletion,
	CourseCompletionData,
	Chapter,
	displayError,
	Error,
	Settings,
	getCurrentBackendDate,
} from "../bindings.ts";
import { TimeProgressMeter } from "../graphing/main.ts";

export interface ListingItem {
	label: string;
	identifier?: string;
	subitems?: ListingItem[];
}

export type ListingCallback = (identifier: string) => void;

// TODO:
// - Reduce DOM updates by combining viewManager.render() and listingManager.render()
// - Optimize event listners using event delegation and event.stopPropagation()

export class ViewManager {
	titleContainer: HTMLElement;
	listingContainer: HTMLElement;
	contentContainer: HTMLDivElement;
	#styleContainer: HTMLStyleElement;
	rendered = false;
	constructor(
		titleContainer: HTMLElement,
		listingContainer: HTMLElement,
		contentContainer: HTMLDivElement,
	) {
		this.titleContainer = titleContainer;
		this.listingContainer = listingContainer;
		this.contentContainer = contentContainer;

		this.#styleContainer = document.createElement("style");
		window.document.head.appendChild(this.#styleContainer);

		this.rendered = false;
	}
	render(
		listing?: ListingItem[],
		callback?: ListingCallback,
		title?: string,
		language?: string,
	) {
		if (language) {
			this.titleContainer.setAttribute("lang", language);
			this.listingContainer.setAttribute("lang", language);
			this.contentContainer.setAttribute("lang", language);
		}

		if (title) {
			this.titleContainer.innerText = title;
		} else {
			this.titleContainer.innerText = "Untitled Book";
		}

		if (listing && callback) {
			this.listingContainer.appendChild(this.#buildListing(listing, callback));
		}

		this.rendered = true;
	}
	#buildListingLabel(
		item: ListingItem,
		callback: ListingCallback,
	): HTMLAnchorElement | HTMLSpanElement {
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
	#buildListing(
		listing: ListingItem[],
		callback: ListingCallback,
	): HTMLOListElement {
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

		const rootSelector = "#" + CSS.escape(this.listingContainer.id);

		const selector = "#" + CSS.escape(identifier);

		this.#styleContainer.innerHTML =
			rootSelector + " " + selector + " {font-weight: bold}";

		const initialElement = this.listingContainer.querySelector(selector);
		let currentElement = initialElement?.parentElement?.parentElement;
		while (
			currentElement &&
			currentElement.parentElement &&
			currentElement.parentElement != this.listingContainer
		) {
			currentElement = currentElement.parentElement;

			if (currentElement.tagName == "DETAILS") {
				currentElement.setAttribute("open", "");
			}
		}

		/*if (initialElement) {
			initialElement.scrollIntoView({ block: "center" });
		}*/
	}
}

function updateCompletion(course: Course, completion: CourseCompletionData) {
	setCourseCompletion(course, completion).catch((error: Error) => {
		displayError(error);
	});
}

export class ProgressManager {
	#completion: CourseCompletionData | undefined = undefined;
	#completedSections: Set<string> = new Set();
	manager: ViewManager;
	timerContainer: HTMLElement;
	settings: Settings;
	rendered = false;
	constructor(
		view: ViewManager,
		timerContainer: HTMLElement,
		settings: Settings,
	) {
		this.manager = view;
		this.timerContainer = timerContainer;
		this.settings = settings;
	}
	render(course: [Course, CourseCompletionData], document_index: number) {
		if (!this.manager.rendered) {
			return;
		}

		this.#completion = course[1];
		if (!this.#completion.books[document_index]) {
			this.#completion.books[document_index] = {
				completed_sections: [],
			};
		}
		this.#completedSections = new Set(
			course[1].books[document_index].completed_sections,
		);
		this.#buildListingProgressTracker(
			{ course: course[0], progress: this.#completion },
			document_index,
		);

		let timeDisplay: TimeProgressMeter | undefined;
		if (this.settings.show_course_clock) {
			timeDisplay = new TimeProgressMeter(
				0,
				this.settings.maximum_course_time * 60,
			);
			timeDisplay.update(this.#completion.time_spent[getCurrentBackendDate()]);
			this.timerContainer.appendChild(timeDisplay.element);
		}

		window.setInterval(() => {
			if (this.#completion) {
				if (!document.hidden) {
					if (this.#completion.time_spent[getCurrentBackendDate()]) {
						this.#completion.time_spent[getCurrentBackendDate()] += 1;
					} else {
						this.#completion.time_spent[getCurrentBackendDate()] = 1;
					}
				}
				updateCompletion(course[0], this.#completion);
				if (timeDisplay) {
					timeDisplay.update(
						this.#completion.time_spent[getCurrentBackendDate()],
					);
				}
			}
		}, 1000);
		window.addEventListener("beforeunload", async () => {
			if (this.#completion) {
				await updateCompletion(course[0], this.#completion);
			}
		});

		this.rendered = true;
	}
	#getListingElement(identifier: string): HTMLElement | null {
		const selector = "#" + CSS.escape(identifier);

		return this.manager.listingContainer.querySelector(selector);
	}
	#buildListingProgressTracker(
		course: { course: Course; progress: CourseCompletionData },
		document_index: number,
	) {
		const textbook = course.course.books[document_index];

		for (const chapter of textbook.chapters) {
			if (chapter.root) {
				const element = this.#getListingElement(chapter.root);

				if (element && element.parentElement) {
					element.parentElement.appendChild(
						this.#buildCheckbox(
							this.#completedSections.has(chapter.root),
							(event) => {
								if (chapter.root && this.#completion && event.target) {
									if ((<HTMLInputElement>event.target).checked) {
										this.#completedSections.add(chapter.root);
									} else {
										this.#completedSections.delete(chapter.root);
									}
									this.#completion.books[document_index].completed_sections =
										Array.from(this.#completedSections);
									this.#showNextChapter(textbook, chapter.root);
								}
							},
						),
					);
				}
			}
			this.#buildSectionProgressTracker(textbook, chapter, document_index);
		}

		this.#showNextChapter(textbook, undefined, true);
	}
	#buildSectionProgressTracker(
		textbook: Textbook,
		chapter: Chapter,
		document_index: number,
	) {
		for (const group of chapter.groups) {
			for (const section of group.sections) {
				const element = this.#getListingElement(section);

				if (element && element.parentElement) {
					element.parentElement.appendChild(
						this.#buildCheckbox(
							this.#completedSections.has(section),
							(event) => {
								if (this.#completion && event.target) {
									if ((<HTMLInputElement>event.target).checked) {
										this.#completedSections.add(section);
									} else {
										this.#completedSections.delete(section);
									}
									this.#updateChapterCompletion(textbook, chapter);
									this.#completion.books[document_index].completed_sections =
										Array.from(this.#completedSections);
								}
							},
						),
					);
				}
			}
		}
	}
	#buildCheckbox(checked: boolean, listener?: (event: Event) => void) {
		const checkbox = document.createElement("input");
		checkbox.setAttribute("type", "checkbox");

		if (checked) {
			checkbox.setAttribute("checked", "");
		}
		if (listener) {
			checkbox.addEventListener("change", listener);
		}

		return checkbox;
	}
	#updateChapterCompletion(textbook: Textbook, chapter: Chapter) {
		if (!this.#completedSections) {
			return;
		}

		for (const group of chapter.groups) {
			for (const section of group.sections) {
				if (!this.#completedSections.has(section)) {
					if (chapter.root) {
						this.#updateChapterCheckbox(chapter.root);
					}
					return;
				}
			}
		}

		if (chapter.root) {
			this.#completedSections.add(chapter.root);
			this.#updateChapterCheckbox(chapter.root);
		}

		this.#showNextChapter(textbook);
	}
	#updateChapterCheckbox(identifier: string) {
		if (!this.#completedSections) {
			return;
		}

		const element = this.#getListingElement(identifier);
		if (element && element.parentElement) {
			const inputElements = element.parentElement.getElementsByTagName("input");

			for (const inputElement of inputElements) {
				if (inputElement.getAttribute("type") == "checkbox") {
					inputElement.checked = this.#completedSections.has(identifier);
				}
			}
		}
	}
	#showNextChapter(textbook: Textbook, chapterId?: string, autoscroll = false) {
		let firstIncomplete = true;

		for (const chapter of textbook.chapters) {
			if (chapter.root) {
				const element = this.#getListingElement(chapter.root);
				if (element) {
					this.#handleListingItemVisibility(
						element,
						this.#completedSections.has(chapter.root),
						firstIncomplete,
						chapterId == chapter.root,
						autoscroll,
					);
				}

				if (!this.#completedSections.has(chapter.root)) {
					firstIncomplete = false;
				}
			} else {
				// If the chapter has no root, treat individual sections as if they were chapters

				for (const group of chapter.groups) {
					for (const section of group.sections) {
						const element = this.#getListingElement(section);
						if (element) {
							this.#handleListingItemVisibility(
								element,
								this.#completedSections.has(section),
								firstIncomplete,
								chapterId == section,
								autoscroll,
							);
						}

						if (!this.#completedSections.has(section)) {
							firstIncomplete = false;
						}
					}
				}
			}
		}
	}
	#handleListingItemVisibility(
		element: HTMLElement,
		completed: boolean,
		firstIncomplete: boolean,
		currentItem: boolean,
		scroll: boolean,
	) {
		if (firstIncomplete) {
			this.#updateListingItemVisibility(
				element,
				!completed,
				!completed,
				!completed && scroll,
			);
		} else if (!(currentItem && !completed)) {
			this.#updateListingItemVisibility(element, false);
		}
	}
	#updateListingItemVisibility(
		element: HTMLElement,
		showItem?: boolean,
		showItemList?: boolean,
		scroll?: boolean,
	) {
		const itemContainer = element?.parentElement?.parentElement;

		if (showItem !== undefined) {
			if (itemContainer && itemContainer.tagName == "DETAILS") {
				(<HTMLDetailsElement>itemContainer).open = showItem;
			}
		}

		if (showItemList !== undefined) {
			let currentElement = element?.parentElement?.parentElement?.parentElement;
			while (
				currentElement &&
				currentElement.parentElement &&
				currentElement.parentElement != this.manager.listingContainer
			) {
				currentElement = currentElement.parentElement;

				if (currentElement.tagName == "DETAILS") {
					(<HTMLDetailsElement>currentElement).open = showItemList;
				}
			}
		}

		if (scroll) {
			if (itemContainer && itemContainer.tagName == "DETAILS") {
				itemContainer.scrollIntoView({ block: "center" });
			} else {
				element.parentElement?.scrollIntoView({ block: "start" });
			}
		}
	}
	savePosition(document_index: number, position: string) {
		if (this.#completion && this.rendered) {
			this.#completion.books[document_index].position = position;
		}
	}
}

export interface DocumentViewer {
	course: Course;
	document_index: number;
	rendered: boolean;
	render(
		view: ViewManager,
		progress: ProgressManager,
		initialProgress: CourseCompletionData,
	): Promise<null | void>;
}
