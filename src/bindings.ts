import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';

// Relevant backend source files:
// - src/api/mod.rs
// - src/api/wrapper.rs

// TODO: Need to check types for correctness

interface CourseMap {
	uuid: string,
	// TODO
}

interface Course {
	uuid: string,
	title: string,
	description?: string,
	books: Textbook[],
}

interface Textbook {
	label: string,
	file: string,
	chapters: Chapter[],
}

interface Chapter {
	root?: string,
	sections: Array<Array<string>>,
}

interface CourseCompletionData {
	completed?: boolean,
	book_sections: Record<number, string[]>,
	time_spent_secs: number,
}

interface CourseProgress {
	completed: boolean,
	completion: TextbookProgress[],
}

interface TextbookProgress {
	overall_completion: number,
	chapter_completion: number[],
}

interface OverallProgress {
	chapters_completed: Record<string, number>,
	time_spent: Record<string, number>,
}

interface Settings {
	// TODO
}

interface Result<Type> {
	Ok: Type,
	Err: Error,
}

type FlatResult<Type> = Type | Error;
type PromiseResult<Type> = Promise<FlatResult<Type>>;

interface Error {
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
