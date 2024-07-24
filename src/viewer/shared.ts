import {
	Course,
	setCourseCompletion,
	CourseCompletionData,
	displayError,
	Error,
	Settings,
	getCurrentBackendDate,
	Chapter,
} from "../bindings.ts";
import { TimeProgressMeter } from "../graphing/main.ts";

// TODO:
// - Reduce DOM updates by combining viewManager.render() and listingManager.render()
// - Optimize event listners using event delegation and event.stopPropagation()

export interface ListingItem {
	label: string;
	identifier?: string;
	subitems?: ListingItem[];
}

export type ListingCallback = (identifier: string) => void;

export interface ViewContainer {
	title: HTMLElement;
	timer: HTMLElement;
	listing: HTMLElement;
	content: HTMLDivElement;
	style?: HTMLStyleElement;
}

export interface DocumentMetadata {
	title: string;
	language: string;
	items: ListingItem[];
	callback: ListingCallback;
}

export interface EncapsulatedCourseTextbook {
	course: Course;
	document_index: number;
	completion: CourseCompletionData;
}

export class ViewManager {
	container: ViewContainer;
	rendered = false;
	settings: Settings;
	savePosition?: (position: string) => void;
	constructor(container: ViewContainer, settings: Settings) {
		this.container = container;
		this.settings = settings;

		if (!this.container.style) {
			this.container.style = document.createElement("style");
			window.document.head.appendChild(this.container.style);
		}
	}
	render(course: EncapsulatedCourseTextbook, metadata: DocumentMetadata) {
		this.container.title.setAttribute("lang", metadata.language);
		this.container.listing.setAttribute("lang", metadata.language);
		this.container.content.setAttribute("lang", metadata.language);
		this.container.title.innerText = metadata.title;

		const listing = this.#buildListing(metadata.items, metadata.callback);
		this.#buildProgressTracker(course, listing);

		this.container.listing.append(listing);

		this.rendered = true;
	}
	highlightListingItem(identifier: string) {
		if (!this.rendered || !this.container.style) {
			return;
		}

		const rootSelector = "#" + CSS.escape(this.container.listing.id);

		const selector = "#" + CSS.escape(identifier);

		this.container.style.innerHTML =
			rootSelector + " " + selector + " {font-weight: bold}";

		const initialElement = this.container.listing.querySelector(selector);
		let currentElement = initialElement?.parentElement?.parentElement;
		while (
			currentElement &&
			currentElement.parentElement &&
			currentElement.parentElement != this.container.listing
		) {
			currentElement = currentElement.parentElement;

			if (currentElement.tagName == "DETAILS") {
				currentElement.setAttribute("open", "");
			}
		}
	}
	#buildListing(
		items: ListingItem[],
		callback?: ListingCallback,
	): HTMLOListElement {
		const root = document.createElement("ol");

		if (callback) {
			root.addEventListener("click", (event) => {
				const target = event.target as HTMLElement;

				if (target.tagName == "A" && target.id) {
					callback(target.id);
					event.preventDefault();
				}
			});
			root.addEventListener("keydown", (event) => {
				const target = event.target as HTMLElement;

				if (event.code == "Enter" && target.tagName == "A" && target.id) {
					callback(target.id);
					event.preventDefault();
				}
			});
		}

		for (const item of items) {
			const container = document.createElement("li");

			let label;
			if (item.identifier) {
				label = document.createElement("a");
				label.setAttribute("tabindex", "0");
				label.setAttribute("role", "button");
				label.setAttribute("id", item.identifier);
			} else {
				label = document.createElement("span");
			}
			label.innerText = item.label;

			if (item.subitems) {
				const subcontainer = document.createElement("details");

				const subcontainer_title = document.createElement("summary");
				subcontainer_title.appendChild(label);
				subcontainer.appendChild(subcontainer_title);

				subcontainer.appendChild(this.#buildListing(item.subitems));

				container.appendChild(subcontainer);
			} else {
				container.appendChild(label);
			}

			root.appendChild(container);
		}

		return root;
	}
	#buildProgressTracker(
		course: EncapsulatedCourseTextbook,
		listing: HTMLOListElement,
	) {
		if (!course.completion.books[course.document_index]) {
			course.completion.books[course.document_index] = {
				completed_sections: [],
			};
		}

		const completed = new Set(
			course.completion.books[course.document_index].completed_sections,
		);
		const chapters: Map<string, Chapter> = new Map();
		const checkboxes: Map<string, HTMLInputElement> = new Map();

		const textbook = course.course.books[course.document_index];

		for (const chapter of textbook.chapters) {
			if (chapter.root) {
				const label = listing.querySelector("#" + CSS.escape(chapter.root));

				if (label) {
					const is_completed = completed.has(chapter.root);
					const checkbox = buildCheckbox(is_completed);
					checkbox.id = "section-" + chapter.root;

					checkboxes.set(chapter.root, checkbox);
					label.parentElement?.appendChild(checkbox);

					chapters.set(chapter.root, chapter);
				}
			}
			for (const group of chapter.groups) {
				for (const section of group.sections) {
					const label = listing.querySelector("#" + CSS.escape(section));

					if (label) {
						const is_completed = completed.has(section);
						const checkbox = buildCheckbox(is_completed);
						checkbox.id = "section-" + section;

						checkboxes.set(section, checkbox);
						label.parentElement?.appendChild(checkbox);

						chapters.set(section, chapter);
					}
				}
			}
		}

		listing.addEventListener("change", (event) => {
			const target = event.target as HTMLElement;

			if (target.tagName == "INPUT" && target.id) {
				const identifier = target.id.substring(8);
				const chapter = chapters.get(identifier);

				if (chapter) {
					const checked = (target as HTMLInputElement).checked;

					const active_chapter_changed = handleProgressUpdate(
						course,
						chapter,
						completed,
						checkboxes,
						identifier,
						checked,
					);

					console.log(active_chapter_changed);

					// TODO: Implement displayNext()
				}
				event.preventDefault();
			}
		});

		let timeDisplay: TimeProgressMeter | undefined;
		if (this.settings.show_course_clock) {
			timeDisplay = new TimeProgressMeter(
				0,
				this.settings.maximum_course_time * 60,
			);
			timeDisplay.update(course.completion.time_spent[getCurrentBackendDate()]);
			this.container.timer.appendChild(timeDisplay.element);
		}

		window.setInterval(() => {
			if (!document.hidden) {
				if (course.completion.time_spent[getCurrentBackendDate()]) {
					course.completion.time_spent[getCurrentBackendDate()] += 1;
				} else {
					course.completion.time_spent[getCurrentBackendDate()] = 1;
				}
			}
			updateCompletion(course.course, course.completion);
			if (timeDisplay) {
				timeDisplay.update(
					course.completion.time_spent[getCurrentBackendDate()],
				);
			}
		}, 1000);
		window.addEventListener("beforeunload", () => {
			updateCompletion(course.course, course.completion);
		});

		this.savePosition = function (position: string) {
			course.completion.books[course.document_index].position = position;
		};
	}
}

function updateCompletion(course: Course, completion: CourseCompletionData) {
	setCourseCompletion(course, completion).catch((error: Error) => {
		displayError(error);
	});
}

function buildCheckbox(checked: boolean) {
	const checkbox = document.createElement("input");
	checkbox.setAttribute("type", "checkbox");

	if (checked) {
		checkbox.setAttribute("checked", "");
	}

	return checkbox;
}

function handleProgressUpdate(
	course: EncapsulatedCourseTextbook,
	chapter: Chapter,
	completed: Set<string>,
	checkboxes: Map<string, HTMLInputElement>,
	identifier: string,
	checked: boolean,
) {
	let updated_chapter_completion = false;

	if (checked) {
		completed.add(identifier);

		let chapter_completed = true;

		if (identifier != chapter.root) {
			outer: for (const group of chapter.groups) {
				for (const section of group.sections) {
					if (!completed.has(section)) {
						chapter_completed = false;
						break outer;
					}
				}
			}
		}

		updated_chapter_completion = chapter_completed;

		if (chapter_completed && chapter.root) {
			completed.add(chapter.root);

			const chapter_checkbox = checkboxes.get(chapter.root);

			if (chapter_checkbox) {
				chapter_checkbox.checked = true;
			}
		}
	} else {
		completed.delete(identifier);

		if (chapter.root) {
			if (completed.has(chapter.root)) {
				completed.delete(chapter.root);

				const chapter_checkbox = checkboxes.get(chapter.root);

				if (chapter_checkbox) {
					chapter_checkbox.checked = false;
				}

				updated_chapter_completion = true;
			} else {
				updated_chapter_completion = identifier == chapter.root;
			}
		}
	}

	course.completion.books[course.document_index].completed_sections =
		Array.from(completed);

	return updated_chapter_completion;
}

/*
export class ProgressManager {
	#completion: CourseCompletionData | undefined = undefined;
	#completedSections: Set<string> = new Set();
	manager: ViewManagerOld;
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
		window.addEventListener("beforeunload", () => {
			if (this.#completion) {
				updateCompletion(course[0], this.#completion);
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
	*/

export interface DocumentViewer {
	course: Course;
	document_index: number;
	rendered: boolean;
	render(
		view: ViewManager,
		initialProgress: CourseCompletionData,
	): Promise<null | void>;
}
