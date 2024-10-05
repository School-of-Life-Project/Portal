import { getVersion } from "@tauri-apps/api/app";
import {
	displayError,
	getSettings,
	openDataDir,
	openDiscussionBoard,
	openInternalDataDir,
	openIssueTracker,
	openRepo,
	openWebsite,
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
const appDiscussionButton = document.getElementById("appDiscussionButton");
const appRepoButton = document.getElementById("appRepoButton");
const resourceButton = document.getElementById("resourceButton");
const internalFolderButton = document.getElementById("internalFolderButton");
const settingsForm = document.getElementById("settingsRoot");
const appVersionLabel = document.getElementById("appVersionLabel");

async function updateSettings(settings?: Settings) {
	return setSettings(settings).catch((error) => {
		displayError(error);
	});
}

async function resetCourses() {
	return setActiveCourses([]).catch((error) => {
		displayError(error);
	});
}

if (resetSettingsButton) {
	resetSettingsButton.addEventListener("click", () => {
		updateSettings().then(() => location.reload());
	});
}

if (resetCoursesButton) {
	resetCoursesButton.addEventListener("click", () => {
		resetCourses().then(() => location.reload());
	});
}

if (appWebsiteButton) {
	appWebsiteButton.addEventListener("click", () => {
		openWebsite().catch((error) => {
			displayError(error);
		});
	});
}

if (appRepoButton) {
	appRepoButton.addEventListener("click", () => {
		openRepo().catch((error) => {
			displayError(error);
		});
	});
}

if (appIssueButton) {
	appIssueButton.addEventListener("click", () => {
		openIssueTracker(false).catch((error) => {
			displayError(error);
		});
	});
}

if (appDiscussionButton) {
	appDiscussionButton.addEventListener("click", () => {
		openDiscussionBoard().catch((error) => {
			displayError(error);
		});
	});
}

if (resourceButton) {
	resourceButton.addEventListener("click", () => {
		openDataDir().catch((error) => {
			displayError(error);
		});
	});
}

if (internalFolderButton) {
	internalFolderButton.addEventListener("click", () => {
		openInternalDataDir().catch((error) => {
			displayError(error);
		});
	});
}

if (appVersionLabel) {
	getVersion().then((version) => {
		appVersionLabel.innerText =
			"Portal v" + version + " by School of Life Project";
	});
}

const settings = await settingsPromise;

console.log(settings);

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
			clockLabel.innerText = "📖 Show viewer stopwatch: ";

			fieldset1.appendChild(clockLabel);
			fieldset1.appendChild(clockCheckbox);
			fieldset1.appendChild(document.createElement("br"));
			clockCheckbox.addEventListener("change", handleInputUpdate);

			const listingCheckbox = document.createElement("input");
			listingCheckbox.type = "checkbox";
			listingCheckbox.id = "show_course_time";
			listingCheckbox.checked = settings.show_course_time as boolean;

			const listingLabel = document.createElement("label");
			listingLabel.setAttribute("for", "show_course_time");
			listingLabel.innerText = " Show listing stopwatch: ";

			fieldset1.appendChild(listingLabel);
			fieldset1.appendChild(listingCheckbox);
			fieldset1.appendChild(document.createElement("br"));
			listingCheckbox.addEventListener("change", handleInputUpdate);

			const courseChunkInput = document.createElement("input");
			courseChunkInput.type = "number";
			courseChunkInput.id = "course_time_chunks";
			courseChunkInput.min = "30";
			courseChunkInput.value = String(settings.course_time_chunks);
			courseChunkInput.max = "360";
			courseChunkInput.step = "1";

			const courseChunkLabel = document.createElement("label");
			courseChunkLabel.setAttribute("for", "course_time_chunks");
			courseChunkLabel.innerText = "🟩 Block count: ";

			fieldset1.appendChild(courseChunkLabel);
			fieldset1.appendChild(courseChunkInput);
			fieldset1.appendChild(document.createElement("br"));
			courseChunkInput.addEventListener("change", handleInputUpdate);

			const courseTimeInput = document.createElement("input");
			courseTimeInput.type = "number";
			courseTimeInput.id = "time_chunk_size";
			courseTimeInput.min = "30";
			courseTimeInput.value = String(settings.time_chunk_size);
			courseTimeInput.max = "360";
			courseTimeInput.step = "1";

			const courseTimeLabel = document.createElement("label");
			courseTimeLabel.setAttribute("for", "time_chunk_size");
			courseTimeLabel.innerText = "⌛️ Block size (in minutes): ";

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
			weekInput.max = "52";
			weekInput.step = "1";

			const weekLabel = document.createElement("label");
			weekLabel.setAttribute("for", "weeks_displayed");
			weekLabel.innerText = "📅 Displayed weeks: ";

			fieldset2.appendChild(weekLabel);
			fieldset2.appendChild(weekInput);
			fieldset2.appendChild(document.createElement("br"));
			weekInput.addEventListener("change", handleInputUpdate);

			const timeCheckbox = document.createElement("input");
			timeCheckbox.type = "checkbox";
			timeCheckbox.id = "show_daily_time";
			timeCheckbox.checked = settings.show_daily_time;

			const timeLabel = document.createElement("label");
			timeLabel.setAttribute("for", "show_daily_time");
			timeLabel.innerText = "🟩 Show time progress: ";

			fieldset2.appendChild(timeLabel);
			fieldset2.appendChild(timeCheckbox);
			fieldset2.appendChild(document.createElement("br"));
			timeCheckbox.addEventListener("change", handleInputUpdate);

			const maxTotalTimeInput = document.createElement("input");
			maxTotalTimeInput.type = "number";
			maxTotalTimeInput.id = "maximum_daily_time";
			maxTotalTimeInput.min = "60";
			maxTotalTimeInput.value = String(settings.maximum_daily_time);
			maxTotalTimeInput.max = "480";
			maxTotalTimeInput.step = "1";

			const maxTotalTimeLabel = document.createElement("label");
			maxTotalTimeLabel.setAttribute("for", "maximum_daily_time");
			maxTotalTimeLabel.innerText = "⌛️ Maximum time (in minutes): ";

			fieldset2.appendChild(maxTotalTimeLabel);
			fieldset2.appendChild(maxTotalTimeInput);
			fieldset2.appendChild(document.createElement("br"));
			maxTotalTimeInput.addEventListener("change", handleInputUpdate);

			const chapterCheckbox = document.createElement("input");
			chapterCheckbox.type = "checkbox";
			chapterCheckbox.id = "show_daily_chapters";
			chapterCheckbox.checked = settings.show_daily_chapters;

			const chapterLabel = document.createElement("label");
			chapterLabel.setAttribute("for", "show_daily_chapters");
			chapterLabel.innerText = "🟥 Show chapter progress: ";

			fieldset2.appendChild(chapterLabel);
			fieldset2.appendChild(chapterCheckbox);
			fieldset2.appendChild(document.createElement("br"));
			chapterCheckbox.addEventListener("change", handleInputUpdate);

			const maxTotalChapterInput = document.createElement("input");
			maxTotalChapterInput.type = "number";
			maxTotalChapterInput.id = "maximum_daily_chapters";
			maxTotalChapterInput.min = "0.2";
			maxTotalChapterInput.value = String(settings.maximum_daily_chapters);
			maxTotalChapterInput.max = "8";
			maxTotalChapterInput.step = "0.1";

			const maxTotalChapterLabel = document.createElement("label");
			maxTotalChapterLabel.setAttribute("for", "maximum_daily_chapters");
			maxTotalChapterLabel.innerText = "📑 Maximum chapters: ";

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
