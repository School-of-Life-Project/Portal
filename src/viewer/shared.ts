import { Course, Textbook, CourseCompletionData } from "../bindings.ts";

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
	#lastTimestamp: DOMHighResTimeStamp | undefined = undefined;
	manager: ViewManager;
	timerContainer: HTMLElement;
	rendered = false;
	constructor (view: ViewManager, timerContainer: HTMLElement) {
		this.manager = view;
		this.timerContainer = timerContainer;
	}
	render(course: Course, document_index: number) {
		if (!this.manager.rendered) {
			return;
		}

		this.#lastTimestamp = performance.now();
		this.#buildListingProgressTracker(course, document_index);

		this.rendered = true;
	}
	reset() {
		if (this.manager.rendered) {
			return;
		}

		this.#lastTimestamp = undefined;
		this.rendered = false;
	}
	#buildListingProgressTracker(course: Course, document_index: number) {
		// TODO: Progress tracking, time display
	}
}

export interface DocumentViewer {
	new(course: Course, document_index: number): Promise<DocumentViewer>;
	render(view: ViewManager, progress: ProgressManager): Promise<null>;
	destroy(): Promise<null>;
}