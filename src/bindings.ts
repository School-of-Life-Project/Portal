import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';

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

interface CourseCompletionData {
	// TODO
}

interface CourseProgress {
	completed: boolean,
	completion: TextbookProgress[],
}

interface TextbookProgress {
	overall_completion: number,
	chapter_completion: number[],
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

interface Settings {
	// TODO
}

interface Result<Type> {
	Ok: Type,
	Err: Error,
}

type FlatResult<Type> = Type | Error;

interface Error {
	message: string,
	cause: string,
}

export function openDataDir() {
	return invoke("open_data_dir");
}

export function getCourseMaps() {
	return invoke("get_course_maps");
}

export function getCourses() {
	return invoke("get_courses").then((courses) => {
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

export function getCoursesActive() {
	return invoke("get_courses_active").then((courses) => {
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

export function getCourse(uuid: string) {
	return invoke("get_course", { id: uuid }).then((course) => {
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

export function setCourseCompletion(uuid: string, completion: CourseCompletionData) {
	return invoke("set_course_completion", {
		id: uuid,
		data: completion
	});
}

export function setCourseActiveStatus(uuid: string, active: boolean) {
	return invoke("set_course_active_status", {
		id: uuid,
		data: active
	});
}

export function getOverallProgress() {
	return invoke("get_overall_progress");
}

export function getSettings(): Promise<FlatResult<Settings>> {
	return invoke("get_settings");
}

export function setSettings(settings: Settings): Promise<FlatResult<null>> {
	return invoke("set_settings", {
		data: settings
	});
}
