import { invoke, convertFileSrc } from "@tauri-apps/api/core";

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

export function getCurrentBackendDate(): BackendDate {
	const date = new Date();

	const year = String(date.getFullYear());
	let month = String(date.getMonth() + 1);
	let day = String(date.getDate());

	if (month.length == 1) {
		month = "0" + month;
	}

	if (day.length == 1) {
		day = "0" + day;
	}

	return year + "-" + month + "-" + day;
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
			message: "Unable to perform internal API call",
			cause: error,
		};
	} else {
		return {
			message: "Unable to perform internal API call",
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

export async function openDataDir(): Promise<null> {
	try {
		return await invoke("open_data_dir");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function openInternalDataDir(): Promise<null> {
	try {
		return await invoke("open_internal_data_dir");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function openIssueTracker(newIssue: boolean): Promise<null> {
	try {
		return await invoke("open_project_issue_tracker", { data: newIssue });
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function openRepo(): Promise<null> {
	try {
		return await invoke("open_project_repo");
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
