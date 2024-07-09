export class TimeProgressMeter {
	min: number;
	max: number;
	size: number;
	element: HTMLTableElement;
	#dataElements: HTMLTableCellElement[] = [];
	constructor (min = 0, max = 150, size = 5) {
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
		const normalizedValue = (value - this.min) / ((this.max - this.min) / this.size);

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

class BookChapterGraph {

}

class LongTermProgressGraph {

}