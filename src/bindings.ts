import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';

// Relevant backend source files:
// - src/api/mod.rs
// - src/api/wrapper.rs

// TODO: Need to test API bindings for bugs

export interface CourseMap {
	uuid: string,
	// TODO
}

export interface Course {
	uuid: string,
	title: string,
	description?: string,
	books: Textbook[],
}

export interface Textbook {
	label: string,
	file: string,
	chapters: Chapter[],
}

export interface Chapter {
	root?: string,
	sections: Array<Array<string>>,
}

export interface CourseCompletionData {
	completed?: boolean,
	book_sections: Record<number, string[]>,
	time_spent_secs: number,
}

export interface CourseProgress {
	completed: boolean,
	completion: TextbookProgress[],
}

export interface TextbookProgress {
	overall_completion: number,
	chapter_completion: number[],
}

export interface OverallProgress {
	chapters_completed: Record<string, number>,
	time_spent: Record<string, number>,
}

export interface Settings {
	// TODO
}

export interface Result<Type> {
	Ok?: Type,
	Err?: Error,
}

export type FlatResult<Type> = Type | Error;
type PromiseResult<Type> = Promise<FlatResult<Type>>;

export interface Error {
	message: string,
	cause: string,
}

function convertBackendAsyncError(error: Error | string | any): Error {
	if (typeof error === "object") {
		return error;
	} else {
		return {
			message: "Unable to perform internal API call",
			cause: error,
		};
	}
}

export async function openDataDir(): PromiseResult<null> {
	try {
		return await invoke("open_data_dir");
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function getCourseMaps(): PromiseResult<Array<Result<CourseMap>>> {
	try {
		return await invoke("get_course_maps");
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function getCourses(): PromiseResult<Array<Result<[Course, CourseProgress]>>> {
	try {
		const courses: FlatResult<Array<Result<[Course, CourseProgress]>>> = await invoke("get_courses");
		if (Array.isArray(courses)) {
			for (const course of courses) {
				if (course.Ok) {
					fixCourseURLs(course.Ok[0]);
				}
			}
		}
		return courses;
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function getCoursesActive(): PromiseResult<Array<Result<[Course, CourseProgress]>>> {
	try {
		const courses: FlatResult<Array<Result<[Course, CourseProgress]>>> = await invoke("get_courses_active");
		if (Array.isArray(courses)) {
			for (const course of courses) {
				if (course.Ok) {
					fixCourseURLs(course.Ok[0]);
				}
			}
		}
		return courses;
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function getCourse(uuid: string): PromiseResult<[Course, CourseCompletionData]> {
	try {
		const course: FlatResult<[Course, CourseCompletionData]> = await invoke("get_course", { id: uuid });
		if (Array.isArray(course)) {
			fixCourseURLs(course[0]);
		}
		return course;
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

function fixCourseURLs(course: Course) {
	if (course.books) {
		for (const book of course.books) {
			book.file = convertFileSrc(book.file);
		}
	}
}

export async function setCourseCompletion(uuid: string, completion: CourseCompletionData): PromiseResult<null> {
	try {
		return await invoke("set_course_completion", {
			id: uuid,
			data: completion
		});
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function setCourseActiveStatus(uuid: string, active: boolean): PromiseResult<null> {
	try {
		return await invoke("set_course_active_status", {
			id: uuid,
			data: active
		});
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function getOverallProgress(): PromiseResult<OverallProgress> {
	try {
		return await invoke("get_overall_progress");
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function getSettings(): PromiseResult<Settings> {
	try {
		return await invoke("get_settings");
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}

export async function setSettings(settings: Settings): PromiseResult<null> {
	try {
		return await invoke("set_settings", {
			data: settings
		});
	} catch (error) {
		return convertBackendAsyncError(error);
	}
}
