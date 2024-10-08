export class TimeProgressMeter {
	min: number;
	max: number;
	size: number;
	element: HTMLTableElement;
	#dataElements: HTMLTableCellElement[] = [];
	constructor(min = 0, max = 150, size = 5) {
		this.min = min;
		this.max = max;
		this.size = size;

		const root = document.createElement("table");
		root.setAttribute("class", "progress-map time-map single-line-map");
		const body = document.createElement("tbody");
		const row = document.createElement("tr");

		const header = document.createElement("th");
		header.innerText = "⏱️";

		row.appendChild(header);

		for (let i = 0; i < this.size; i++) {
			const dataElement = document.createElement("td");
			this.#dataElements.push(dataElement);
			row.appendChild(dataElement);
		}
		body.appendChild(row);
		root.appendChild(body);

		this.element = root;
	}
	update(value = this.min) {
		const normalizedValue =
			(value - this.min) / ((this.max - this.min) / this.size);

		const lowerBound = Math.floor(normalizedValue);
		const upperBound = Math.floor(normalizedValue + 0.5);

		this.#dataElements.forEach((element, i) => {
			if (lowerBound > i) {
				element.className = "finished";
			} else if (upperBound > i) {
				element.className = "incomplete";
			} else {
				element.className = "";
			}
		});
	}
}

export class BookChapterGraph {
	title: string | undefined;
	chapters: number;
	width: number;
	element: HTMLTableElement;
	#dataElements: HTMLTableCellElement[] = [];
	constructor(chapters: number, title?: string, width = 10) {
		this.title = title;
		this.chapters = chapters;
		this.width = width;

		const root = document.createElement("table");
		root.setAttribute("class", "progress-map chapter-map");
		if (this.title) {
			const caption = document.createElement("caption");
			if (chapters == 0) {
				caption.innerText = "📒 " + this.title;
			} else {
				caption.innerText = "📕 " + this.title;
			}

			root.appendChild(caption);
		}

		const body = document.createElement("tbody");

		const height = Math.ceil(this.chapters / this.width);

		for (let ii = 0; ii < height; ii++) {
			const row = document.createElement("tr");
			for (let i = 0; i < this.width; i++) {
				const dataElement = document.createElement("td");
				this.#dataElements.push(dataElement);
				row.appendChild(dataElement);
				if (this.#dataElements.length >= this.chapters) {
					if (i != this.width - 1) {
						const padElement = document.createElement("td");
						padElement.classList.add("pad");
						row.appendChild(padElement);
					}
					break;
				}
			}
			body.appendChild(row);
		}
		root.appendChild(body);

		this.element = root;
	}
	update(progress: number[] = []) {
		for (let i = 0; i < this.#dataElements.length; i++) {
			const element = this.#dataElements[i];

			if (i >= progress.length) {
				element.className = "";
				continue;
			}

			const value = Number(progress[i]);

			if (value >= 1) {
				element.className = "finished";
			} else if (value > 0) {
				element.className = "incomplete";
			} else {
				element.className = "";
			}
		}
	}
}

const dayNames = ["", "Mon", "", "Wed", "", "Fri", ""];

export class LongTermProgressGraph {
	type: string | undefined;
	weeks: number;
	min: number;
	max: number;
	element: HTMLDivElement;
	keyElement: HTMLTableElement;
	graphElement: HTMLTableElement;
	#levels: number;
	#dataElements: HTMLTableCellElement[] = [];
	constructor(type: string, weeks = 24, min = 0, max?: number) {
		if (type === "time" || type === "chapter") {
			this.type = type;
		}
		this.weeks = weeks;
		this.min = min;
		if (max) {
			this.max = max;
		} else {
			switch (this.type) {
				case "chapter":
					this.max = 1.5;
					break;
				case "time":
					this.max = 300;
					break;
				default:
					this.max = 0;
					break;
			}
		}
		switch (this.type) {
			case "chapter":
				this.#levels = 3;
				break;
			case "time":
				this.#levels = 5;
				break;
			default:
				this.#levels = 0;
		}

		this.keyElement = this.#renderKey();
		this.graphElement = this.#renderGraph();

		const container = document.createElement("div");
		container.appendChild(this.graphElement);
		container.appendChild(this.keyElement);

		this.element = container;
	}
	#renderGraph() {
		const root = document.createElement("table");
		root.setAttribute("class", "progress-map");

		const body = document.createElement("tbody");

		switch (this.type) {
			case "chapter":
				root.classList.add("chapter-map");
				break;
			case "time":
				root.classList.add("time-map");
				break;
			default:
				return root;
		}

		for (let ii = 0; ii < 7; ii++) {
			const row = document.createElement("tr");

			const rowHeader = document.createElement("th");
			rowHeader.innerText = dayNames[ii];

			row.appendChild(rowHeader);

			for (let i = 0; i <= this.weeks; i++) {
				const dataElement = document.createElement("td");
				this.#dataElements.push(dataElement);
				row.appendChild(dataElement);
			}
			body.appendChild(row);
		}

		const footer = document.createElement("tfoot");
		const footerRow = document.createElement("tr");

		const footerCornerItem = document.createElement("th");
		footerCornerItem.innerText = "Week";
		footerRow.appendChild(footerCornerItem);

		for (let i = this.weeks; i >= 0; i--) {
			const label = document.createElement("th");
			if (i % 4 == 0 && i != 0) {
				label.innerText = String(i);
			}
			footerRow.appendChild(label);
		}

		footer.appendChild(footerRow);

		root.appendChild(body);
		root.appendChild(footer);
		return root;
	}
	#renderKey() {
		const root = document.createElement("table");
		root.setAttribute("class", "progress-map color-key");
		const body = document.createElement("tbody");
		const row = document.createElement("tr");

		const headerLess = document.createElement("th");
		headerLess.innerText = "Less";

		const headerMore = document.createElement("th");
		headerMore.innerText = "More";

		const itemZero = document.createElement("td");

		row.appendChild(headerLess);
		row.appendChild(itemZero);

		switch (this.type) {
			case "chapter":
				root.classList.add("chapter-map");
				break;
			case "time":
				root.classList.add("time-map");
				break;
			default:
				return root;
		}

		for (let i = 1; i <= this.#levels; i++) {
			const item = document.createElement("td");
			item.setAttribute("class", "level-" + i);
			row.appendChild(item);
		}

		row.appendChild(headerMore);

		body.appendChild(row);
		root.appendChild(body);
		return root;
	}
	#getDay(day: number) {
		day = (this.weeks + 1) * 7 - day;

		return this.#dataElements[
			(day % 7) * (this.weeks + 1) + Math.floor(day / 7)
		];
	}
	update(progress: number[] = [], activeIndex?: number) {
		for (let i = 0; i < this.#dataElements.length; i++) {
			const element = this.#getDay(i + 1);

			if (i >= progress.length) {
				element.className = "";
				break;
			}

			if (Number.isNaN(progress[i])) {
				element.className = "no-data";
				continue;
			}

			const normalizedValue = Math.min(
				Math.max(
					(progress[i] - this.min) / ((this.max - this.min) / this.#levels),
					0,
				),
				this.#levels,
			);

			let level = Math.floor(normalizedValue);

			if (level == 0 && normalizedValue >= 0.5) {
				level = 1;
			}

			element.className = "level-" + level;

			if (i == activeIndex) {
				element.classList.add("in-progress");
			}
		}
	}
}
