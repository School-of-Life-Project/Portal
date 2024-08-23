import {
	displayError,
	getSettings,
	openIssueTracker,
	openRepo,
	setActiveCourses,
	setSettings,
	Settings,
} from "../bindings";

const settingsPromise = getSettings().catch((error) => {
	displayError(error);
});

const resetCoursesButton = document.getElementById("resetCoursesButton");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const appWebsiteButton = document.getElementById("appWebsiteButton");
const appIssueButton = document.getElementById("appIssueButton");
const settingsForm = document.getElementById("settingsRoot");

function updateSettings(settings?: Settings) {
	setSettings(settings).catch((error) => {
		displayError(error);
	});
}

function resetCourses() {
	setActiveCourses([]).catch((error) => {
		displayError(error);
	});
}

if (resetSettingsButton) {
	resetSettingsButton.addEventListener("click", () => {
		updateSettings();
		location.reload();
	});
	resetSettingsButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			updateSettings();
			location.reload();
		}
	});
}

if (resetCoursesButton) {
	resetCoursesButton.addEventListener("click", () => {
		resetCourses();
	});
	resetCoursesButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			resetCourses();
		}
	});
}

if (appWebsiteButton) {
	appWebsiteButton.addEventListener("click", () => {
		openRepo();
	});
	appWebsiteButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			openRepo();
		}
	});
}

if (appIssueButton) {
	appIssueButton.addEventListener("click", () => {
		openIssueTracker(false);
	});
	appIssueButton.addEventListener("keydown", (event) => {
		if (event.code == "Enter") {
			openIssueTracker(false);
		}
	});
}

const settings = await settingsPromise;

if (settingsForm && settings) {
	const form = buildSettingsForm(settings);

	settingsForm.innerHTML = "";
	settingsForm.appendChild(form);
}

function buildSettingsForm(settings: Settings) {
	const root = document.createDocumentFragment();

	const appearance = document.createElement("section");

	{
		const title = document.createElement("h2");
		title.innerText = " Interface Settings";

		const fieldset1 = document.createElement("fieldset");

		{
			const title = document.createElement("legend");
			title.innerText = "⏱ Course Stopwatch";

			fieldset1.appendChild(title);

			const clockCheckbox = document.createElement("input");
			clockCheckbox.type = "checkbox";
			clockCheckbox.id = "show_course_clock";
			clockCheckbox.checked = settings.show_course_clock;

			const clockLabel = document.createElement("label");
			clockLabel.setAttribute("for", "show_course_clock");
			clockLabel.innerText = "Show stopwatch in textbook viewer";

			fieldset1.appendChild(clockCheckbox);
			fieldset1.appendChild(clockLabel);
			fieldset1.appendChild(document.createElement("br"));
			clockCheckbox.addEventListener("change", handleInputUpdate);

			const courseTimeInput = document.createElement("input");
			courseTimeInput.type = "number";
			courseTimeInput.id = "maximum_course_time";
			courseTimeInput.min = "30";
			courseTimeInput.value = String(settings.maximum_course_time);
			courseTimeInput.max = "360";
			courseTimeInput.step = "1";

			const courseTimeLabel = document.createElement("label");
			courseTimeLabel.setAttribute("for", "maximum_course_time");
			courseTimeLabel.innerText = "Maximum displayed time (in minutes): ";

			fieldset1.appendChild(courseTimeLabel);
			fieldset1.appendChild(courseTimeInput);
			courseTimeInput.addEventListener("change", handleInputUpdate);
		}

		const fieldset2 = document.createElement("fieldset");

		{
			const title = document.createElement("legend");
			title.innerText = "🗓 Progress Display";

			fieldset2.appendChild(title);

			const weekInput = document.createElement("input");
			weekInput.type = "number";
			weekInput.id = "weeks_displayed";
			weekInput.min = "8";
			weekInput.value = String(settings.weeks_displayed);
			weekInput.max = "48";
			weekInput.step = "1";

			const weekLabel = document.createElement("label");
			weekLabel.setAttribute("for", "weeks_displayed");
			weekLabel.innerText = "Weeks displayed: ";

			fieldset2.appendChild(weekLabel);
			fieldset2.appendChild(weekInput);
			fieldset2.appendChild(document.createElement("br"));
			weekInput.addEventListener("change", handleInputUpdate);

			const maxTotalTimeInput = document.createElement("input");
			maxTotalTimeInput.type = "number";
			maxTotalTimeInput.id = "maximum_daily_time";
			maxTotalTimeInput.min = "60";
			maxTotalTimeInput.value = String(settings.maximum_daily_time);
			maxTotalTimeInput.max = "480";
			maxTotalTimeInput.step = "1";

			const maxTotalTimeLabel = document.createElement("label");
			maxTotalTimeLabel.setAttribute("for", "maximum_daily_time");
			maxTotalTimeLabel.innerText = "Maximum displayed time (in minutes): ";

			fieldset2.appendChild(maxTotalTimeLabel);
			fieldset2.appendChild(maxTotalTimeInput);
			fieldset2.appendChild(document.createElement("br"));
			maxTotalTimeInput.addEventListener("change", handleInputUpdate);

			const maxTotalChapterInput = document.createElement("input");
			maxTotalChapterInput.type = "number";
			maxTotalChapterInput.id = "maximum_daily_chapters";
			maxTotalChapterInput.min = "0.5";
			maxTotalChapterInput.value = String(settings.maximum_daily_chapters);
			maxTotalChapterInput.max = "8";
			maxTotalChapterInput.step = "0.1";

			const maxTotalChapterLabel = document.createElement("label");
			maxTotalChapterLabel.setAttribute("for", "maximum_daily_chapters");
			maxTotalChapterLabel.innerText = "Maximum displayed chapters: ";

			fieldset2.appendChild(maxTotalChapterLabel);
			fieldset2.appendChild(maxTotalChapterInput);
			fieldset2.appendChild(document.createElement("br"));
			maxTotalChapterInput.addEventListener("change", handleInputUpdate);
		}

		appearance.appendChild(title);
		appearance.appendChild(fieldset1);
		appearance.appendChild(fieldset2);
	}

	root.appendChild(appearance);

	return root;
}

function handleInputUpdate(event: Event) {
	if (
		event.target &&
		(event.target as HTMLElement).tagName == "INPUT" &&
		(event.target as HTMLElement).id &&
		settings
	) {
		const target = event.target as HTMLInputElement;

		if (target.type == "number") {
			if (target.value && target.validity.valid) {
				// @ts-expect-error direct Settings access
				settings[target.id] = Number(target.value);

				updateSettings(settings);
			} else {
				// @ts-expect-error direct Settings access
				target.value = settings[target.id];
			}
		}

		if (target.type == "checkbox") {
			// @ts-expect-error direct Settings access
			settings[target.id] = target.checked;

			updateSettings(settings);
		}
	}
}
