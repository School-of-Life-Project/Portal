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
		root.setAttribute("class", "progress-map hourly-progress-map");
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
				element.className = "in-progress";
			} else {
				element.className = "";
			}
			element.style.cssText = "color: transparent"; // Ugly hack
			element.style.cssText = ""; // Ugly hack
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
		root.setAttribute("class", "progress-map chapter-progress-map");
		if (this.title) {
			const caption = document.createElement("caption");
			caption.innerText = "📖 " + this.title;
			root.appendChild(caption);
		}

		const body = document.createElement("tbody");

		let height = Math.ceil(this.chapters / this.width);

		for (let ii = 0; ii < height; ii++) {
			const row = document.createElement("tr");
			for (let i = 0; i < this.width; i++) {
				const dataElement = document.createElement("td");
				this.#dataElements.push(dataElement);
				row.appendChild(dataElement);
				if (this.#dataElements.length >= this.chapters) {
					break;
				}
			}
			body.appendChild(row);
		}
		root.appendChild(body);

		this.element = root;
	}
	update(progress = []) {
		for (let i = 0; i < this.#dataElements.length; i++) {
			const element = this.#dataElements[i];

			if (i >= progress.length) {
				element.className = "";
				element.style.cssText = "color: transparent"; // Ugly hack
				element.style.cssText = ""; // Ugly hack
				continue;
			}

			const value = Number(progress[i]);

			if (value >= 1) {
				element.className = "finished";
			} else if (value > 0) {
				element.className = "in-progress";
			} else {
				element.className = "";
			}
			element.style.cssText = "color: transparent"; // Ugly hack
			element.style.cssText = ""; // Ugly hack
		}
	}
}

/*class LongTermProgressGraph {
	// TODO
}
*/
