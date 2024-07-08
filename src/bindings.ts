import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';

// Relevant backend source files:
// - src/api/mod.rs
// - src/api/wrapper.rs

// TODO: Need to check types for correctness

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
	Ok: Type,
	Err: Error,
}

export type FlatResult<Type> = Type | Error;
type PromiseResult<Type> = Promise<FlatResult<Type>>;

export interface Error {
	message: string,
	cause: string,
}

export function openDataDir(): PromiseResult<null> {
	return invoke("open_data_dir");
}


export function getCourseMaps(): PromiseResult<Array<Result<CourseMap>>> {
	return invoke("get_course_maps");
}

export function getCourses(): PromiseResult<Array<Result<[Course, CourseProgress]>>> {
	let result: PromiseResult<Array<Result<[Course, CourseProgress]>>> = invoke("get_courses");

	return result.then((courses) => {
		if (Array.isArray(courses)) {
			for (const course of courses) {
				if (course.Ok) {
					normalizeCourse(course.Ok[0]);
				}
			}
		}
		return courses;
	});
}

export function getCoursesActive(): PromiseResult<Array<Result<[Course, CourseProgress]>>> {
	let result: PromiseResult<Array<Result<[Course, CourseProgress]>>> = invoke("get_courses_active");

	return result.then((courses) => {
		if (Array.isArray(courses)) {
			for (const course of courses) {
				if (course.Ok) {
					normalizeCourse(course.Ok[0]);
				}
			}
		}
		return courses;
	});
}

export function getCourse(uuid: string): PromiseResult<[Course, CourseCompletionData]> {
	let result: PromiseResult<[Course, CourseCompletionData]> = invoke("get_course", { id: uuid });

	return result.then((course) => {
		if (Array.isArray(course)) {
			normalizeCourse(course[0]);
		}
		return course;
	});
}

function normalizeCourse(course: Course) {
	if (course.books) {
		for (const book of course.books) {
			book.file = convertFileSrc(book.file);
		}
	}
}

export function setCourseCompletion(uuid: string, completion: CourseCompletionData): PromiseResult<null> {
	return invoke("set_course_completion", {
		id: uuid,
		data: completion
	});
}

export function setCourseActiveStatus(uuid: string, active: boolean): PromiseResult<null> {
	return invoke("set_course_active_status", {
		id: uuid,
		data: active
	});
}

export function getOverallProgress(): PromiseResult<OverallProgress> {
	return invoke("get_overall_progress");
}

export function getSettings(): PromiseResult<Settings> {
	return invoke("get_settings");
}

export function setSettings(settings: Settings): PromiseResult<null> {
	return invoke("set_settings", {
		data: settings
	});
}
