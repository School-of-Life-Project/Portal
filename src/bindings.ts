import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

const projectRepoURL = "https://github.com/School-of-Life-Project/Portal-App";
const issueTrackerURL =
	"https://github.com/School-of-Life-Project/Portal-App/issues";
const newIssueURL =
	"https://github.com/School-of-Life-Project/Portal-App/issues/new";

// Based on /src-tauri/src/course/mod.rs

export interface CourseMap {
	uuid: string;
	title: string;
	description?: string;
	courses: CourseMapCourse[];
}

export interface CourseMapCourse {
	uuid: string;
	label: string;
	color?: string;
	relations: CourseMapRelation[];
}

export interface CourseMapRelation {
	uuid: string;
	type: string;
	optional: boolean;
}

export interface Course {
	uuid: string;
	title: string;
	description?: string;
	books: Textbook[];
}

export interface Textbook {
	label: string;
	file: string;
	chapters: Chapter[];
}

export interface Chapter {
	root?: string;
	groups: SectionGroup[];
}

export interface SectionGroup {
	weight?: number;
	sections: string[];
}

// Based on /src-tauri/src/progress/mod.rs

type BackendDate = string;

export interface CourseCompletionData {
	time_spent: Record<BackendDate, number>;
	books: Record<number, CourseCompletionTextbookData>;
}

export interface CourseCompletionTextbookData {
	completed_sections: string[];
	position?: string;
}

export interface CourseProgress {
	completion: TextbookProgress[];
	time_spent_today: number;
}

export interface TextbookProgress {
	overall_completion: number;
	chapter_completion: number[];
}

export interface OverallProgress {
	chapters_completed: Record<BackendDate, number>;
	time_spent: Record<BackendDate, number>;
}

export interface Settings {
	show_course_clock: boolean;
	maximum_course_time: number;
	maximum_daily_time: number;
	maximum_daily_chapters: number;
	weeks_displayed: number;
}

export async function getBackendDate(): Promise<BackendDate> {
	try {
		return await invoke("get_backend_date");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export function parseBackendDate(dateString: BackendDate) {
	const dateValues: string[] = dateString.split("-");
	return new Date(
		Number(dateValues[0]),
		Number(dateValues[1]) - 1,
		Number(dateValues[2]),
	);
}

// Based on /src-tauri/src/api/util.rs

export interface Result<Type> {
	Ok?: Type;
	Err?: Error;
}

export interface Error {
	message: string;
	cause: string;
}

function isError(error: unknown): error is Error {
	return (
		error !== null &&
		typeof error === "object" &&
		(error as Error).message !== undefined &&
		(error as Error).cause !== undefined &&
		typeof (error as Error).message === "string" &&
		typeof (error as Error).cause == "string"
	);
}

function convertBackendAsyncError(error: Error | string | unknown): Error {
	if (isError(error)) {
		return error;
	} else if (typeof error === "string") {
		return {
			message: "Unable to perform API call",
			cause: error,
		};
	} else {
		return {
			message: "Unable to perform API call",
			cause: String(error),
		};
	}
}

export function displayError(error: Error) {
	const params = new URLSearchParams();

	params.set("message", error.message);
	params.set("cause", error.cause);

	window.location.assign("/error.html?" + params.toString());
}

// Based on /src-tauri/src/api/mod.rs

export async function openDataDir(): Promise<void> {
	try {
		const path: string = await invoke("get_data_dir");
		return await open(path);
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function openInternalDataDir(): Promise<void> {
	try {
		const path: string = await invoke("get_internal_data_dir");
		return await open(path);
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function openIssueTracker(newIssue: boolean): Promise<void> {
	try {
		if (newIssue) {
			return await open(newIssueURL);
		} else {
			return await open(issueTrackerURL);
		}
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function openRepo(): Promise<void> {
	try {
		return await open(projectRepoURL);
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getCourse(
	uuid: string,
): Promise<[Course, CourseCompletionData]> {
	try {
		const course: [Course, CourseCompletionData] = await invoke("get_course", {
			uuid,
		});
		if (Array.isArray(course)) {
			if (course[0].books) {
				for (const book of course[0].books) {
					book.file = convertFileSrc(book.file) + "/";
				}
			}
		}
		return course;
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function setCourseCompletion(
	course: Course,
	completion: CourseCompletionData,
): Promise<null> {
	try {
		return await invoke("set_course_completion", {
			course,
			completion,
		});
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getActiveCourses(): Promise<string[]> {
	try {
		return await invoke("get_active_courses");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function setActiveCourses(courses: string[]): Promise<null> {
	try {
		return await invoke("set_active_courses", {
			courses,
		});
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getAll(): Promise<ListingResult> {
	try {
		return await invoke("get_all");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export interface ListingResult {
	courses: Array<[Course, CourseProgress]>;
	course_maps: Array<[CourseMap, string]>;
}

export async function getActive(): Promise<Array<[Course, CourseProgress]>> {
	try {
		return await invoke("get_active");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getOverallProgress(): Promise<OverallProgress> {
	try {
		return await invoke("get_overall_progress");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getSettings(): Promise<Settings> {
	try {
		return await invoke("get_settings");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function setSettings(settings?: Settings): Promise<null> {
	try {
		return await invoke("set_settings", {
			settings,
		});
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}
