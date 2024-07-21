import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";

// Relevant source files:
// - /src-tauri/src/api/mod.rs
// - /src-tauri/src/api/wrapper.rs
// - /error.html

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

export interface CourseCompletionData {
	completed?: boolean;
	book_sections: Record<number, string[]>;
	time_spent: Record<string, number>;
	position: Record<number, string>;
}

export interface CourseProgress {
	completed: boolean;
	completion: TextbookProgress[];
	time_spent_today: number;
}

export interface TextbookProgress {
	overall_completion: number;
	chapter_completion: number[];
}

export interface OverallProgress {
	chapters_completed: Record<string, number>;
	time_spent: Record<string, number>;
}

export interface Settings {
	show_course_clock: boolean;
	maximum_course_time: number;
	maximum_daily_time: number;
	maximum_daily_chapters: number;
	weeks_displayed: number;
}

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
			cause: JSON.stringify(error),
		};
	}
}

export async function openDataDir(): Promise<null> {
	try {
		return await invoke("open_data_dir");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export function displayError(error: Error) {
	const params = new URLSearchParams();

	params.set("message", error.message);
	params.set("cause", error.cause);

	window.location.assign("/error.html?" + params.toString());
}

export async function getCourseMaps(): Promise<
	Array<Result<[CourseMap, string]>>
> {
	try {
		return await invoke("get_course_maps");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getCourses(): Promise<
	Array<Result<[Course, CourseProgress]>>
> {
	try {
		return await invoke("get_courses");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getCoursesActive(): Promise<
	Array<Result<[Course, CourseProgress]>>
> {
	try {
		return await invoke("get_courses_active");
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function getCourse(
	uuid: string,
): Promise<[Course, CourseCompletionData]> {
	try {
		const course: [Course, CourseCompletionData] = await invoke("get_course", {
			id: uuid,
		});
		if (Array.isArray(course)) {
			if (course[0].books) {
				for (const book of course[0].books) {
					if (book.file.endsWith("/")) {
						book.file =
							convertFileSrc(book.file.slice(undefined, book.file.length - 1)) +
							"/";
					} else {
						book.file = convertFileSrc(book.file);
					}
				}
			}
		}
		return course;
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function setCourseCompletion(
	uuid: string,
	completion: CourseCompletionData,
): Promise<null> {
	try {
		return await invoke("set_course_completion", {
			id: uuid,
			data: completion,
		});
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}

export async function setCourseActiveStatus(
	uuid: string,
	active: boolean,
): Promise<null> {
	try {
		return await invoke("set_course_active_status", {
			id: uuid,
			data: active,
		});
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

export async function setSettings(settings: Settings): Promise<null> {
	try {
		return await invoke("set_settings", {
			data: settings,
		});
	} catch (error) {
		throw convertBackendAsyncError(error);
	}
}
