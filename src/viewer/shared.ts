import {
	Course,
	setCourseCompletion,
	CourseCompletionData,
	displayError,
	Error,
	Settings,
	getBackendDate,
	Chapter,
	Textbook,
} from "../bindings.ts";
import { TimeProgressMeter } from "../graphing/main.ts";

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
	#labels: Map<string, HTMLAnchorElement | HTMLSpanElement> = new Map();
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

		console.log({
			title: metadata.title,
			lang: metadata.language,
			toc: metadata.items,
		});

		this.rendered = true;
	}
	highlightListingItem(identifier: string) {
		if (!this.rendered || !this.container.style) {
			return;
		}

		this.container.style.innerHTML =
			"#label-" + CSS.escape(identifier) + " {font-weight: bold}";

		const initialElement = this.#labels.get(identifier);
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
		state: { index: number } = { index: 0 },
	): HTMLOListElement {
		const root = document.createElement("ol");

		if (callback) {
			root.addEventListener("click", (event) => {
				const target = event.target as HTMLElement;

				if (target.tagName == "A" && target.id) {
					callback(target.id.substring(6));
					event.preventDefault();
				}
			});
			root.addEventListener("keydown", (event) => {
				const target = event.target as HTMLElement;

				if (event.code == "Enter" && target.tagName == "A" && target.id) {
					callback(target.id.substring(6));
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
				label.id = "label-" + item.identifier;

				this.#labels.set(item.identifier, label);
			} else {
				label = document.createElement("span");
				label.id = "label-span-" + state.index;
				item.identifier = "span-" + state.index;

				this.#labels.set("span-" + state.index, label);
			}
			label.innerText = item.label;

			if (item.subitems) {
				const subcontainer = document.createElement("details");

				const subcontainer_title = document.createElement("summary");
				subcontainer_title.appendChild(label);
				subcontainer.appendChild(subcontainer_title);

				subcontainer.appendChild(
					this.#buildListing(item.subitems, undefined, state),
				);

				container.appendChild(subcontainer);
			} else {
				container.appendChild(label);
			}

			root.appendChild(container);

			state.index = state.index + 1;
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
				const label = this.#labels.get(chapter.root);

				/*if (!label && chapter.root.startsWith("label-")) {
					label = this.#labels.get(chapter.root.substring(6));
				}*/

				if (label) {
					const is_completed = completed.has(chapter.root);
					const checkbox = buildCheckbox(is_completed);
					checkbox.id = "section-" + chapter.root;

					checkboxes.set(chapter.root, checkbox);
					label.parentElement?.appendChild(checkbox);

					chapters.set(chapter.root, chapter);
				} else {
					displayError({
						message: "Unable to display Course " + course.course.uuid,
						cause: "Unable to find chapter root " + chapter.root,
					});
				}
			}
			for (const group of chapter.groups) {
				for (const section of group.sections) {
					const label = this.#labels.get(section);

					/*if (!label && section.startsWith("label-")) {
						label = this.#labels.get(section.substring(6));
					}*/

					if (label) {
						const is_completed = completed.has(section);
						const checkbox = buildCheckbox(is_completed);
						checkbox.id = "section-" + section;

						checkboxes.set(section, checkbox);
						label.parentElement?.appendChild(checkbox);

						chapters.set(section, chapter);
					} else {
						displayError({
							message: "Unable to display Course " + course.course.uuid,
							cause: "Unable to find section " + section,
						});
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

					if (active_chapter_changed) {
						showNextChapter(
							listing,
							this.#labels,
							textbook,
							completed,
							identifier,
						);
					}
				}
				event.preventDefault();
			}
		});

		let timeDisplay: TimeProgressMeter | undefined;
		if (this.settings.show_course_clock) {
			getBackendDate()
				.then((backendDate) => {
					timeDisplay = new TimeProgressMeter(
						0,
						this.settings.maximum_course_time * 60,
					);
					timeDisplay.update(course.completion.time_spent[backendDate]);
					this.container.timer.appendChild(timeDisplay.element);
				})
				.catch((error: Error) => {
					displayError(error);
				});
		}

		window.setInterval(() => {
			getBackendDate()
				.then((backendDate) => {
					if (!document.hidden) {
						if (course.completion.time_spent[backendDate]) {
							course.completion.time_spent[backendDate] += 1;
						} else {
							course.completion.time_spent[backendDate] = 1;
						}
					}
					updateCompletion(course.course, course.completion);
					if (timeDisplay) {
						timeDisplay.update(course.completion.time_spent[backendDate]);
					}
				})
				.catch((error: Error) => {
					displayError(error);
				});
		}, 1000);
		window.addEventListener("visibilitychange", () => {
			if (document.visibilityState == "hidden") {
				updateCompletion(course.course, course.completion);
			}
		});

		this.savePosition = function (position: string) {
			course.completion.books[course.document_index].position = position;
		};

		this.container.listing.append(listing);

		showNextChapter(
			listing,
			this.#labels,
			textbook,
			completed,
			undefined,
			true,
		);
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

		if (chapter.root) {
			let chapter_completed = true;

			if (identifier != chapter.root) {
				for (const group of chapter.groups) {
					for (const section of group.sections) {
						if (!completed.has(section)) {
							chapter_completed = false;
							break;
						}
					}
				}
			}

			updated_chapter_completion = chapter_completed;

			if (chapter_completed) {
				completed.add(chapter.root);

				const chapter_checkbox = checkboxes.get(chapter.root);

				if (chapter_checkbox) {
					chapter_checkbox.checked = true;
				}
			}
		} else {
			updated_chapter_completion = true;
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
		} else {
			updated_chapter_completion = true;
		}
	}

	course.completion.books[course.document_index].completed_sections =
		Array.from(completed);

	return updated_chapter_completion;
}

function showNextChapter(
	listing: HTMLOListElement,
	labels: Map<string, HTMLElement>,
	textbook: Textbook,
	completed: Set<string>,
	identifier?: string,
	autoscroll = false,
) {
	let firstIncomplete = true;

	for (const chapter of textbook.chapters) {
		if (chapter.root) {
			const element = labels.get(chapter.root);
			if (element) {
				handleListingItemVisibility(
					listing,
					element,
					completed.has(chapter.root),
					firstIncomplete,
					identifier == chapter.root,
					autoscroll,
				);

				if (!completed.has(chapter.root)) {
					firstIncomplete = false;
				}
			}
		} else {
			// If the chapter has no root, treat individual sections as if they were chapters

			for (const group of chapter.groups) {
				for (const section of group.sections) {
					const element = labels.get(section);
					if (element) {
						handleListingItemVisibility(
							listing,
							element,
							completed.has(section),
							firstIncomplete,
							identifier == section,
							autoscroll,
						);

						if (!completed.has(section)) {
							firstIncomplete = false;
						}
					}
				}
			}
		}
	}
}

function handleListingItemVisibility(
	listing: HTMLOListElement,
	element: HTMLElement,
	completed: boolean,
	firstIncomplete: boolean,
	currentItem: boolean,
	scroll: boolean,
) {
	if (firstIncomplete) {
		updateListingItemVisibility(
			listing,
			element,
			!completed,
			!completed,
			!completed && scroll,
		);
	} else if (!(currentItem && !completed)) {
		updateListingItemVisibility(listing, element, false);
	}
}

function updateListingItemVisibility(
	listing: HTMLOListElement,
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
			currentElement.parentElement != listing
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

export interface DocumentViewer {
	course: Course;
	document_index: number;
	rendered: boolean;
	render(
		view: ViewManager,
		initialProgress: CourseCompletionData,
	): Promise<null | void>;
}
