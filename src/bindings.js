import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';

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

export function getCourse(uuid) {
	return window
		.__TAURI_INVOKE__("get_course", {
			id: uuid
		})
		.then((course) => {
			if (Array.isArray(course)) {
				normalizeCourse(course[0]);
			}
			return course;
		});
}

function normalizeCourse(course) {
	if (course.books) {
		for (const book of course.books) {
			book.file = convertFileSrc(book.file);
		}
	}
}

export function setCourseCompletion(uuid, completion) {
	return invoke("set_course_completion", {
		id: uuid,
		data: completion
	});
}

export function setCourseActiveStatus(uuid, active) {
	return invoke("get_course_active_status", {
		id: uuid,
		data: active
	});
}

export function getOverallProgress() {
	return invoke("get_overall_progress");
}

export function getSettings() {
	return invoke("get_settings");
}

export function setSettings(settings) {
	return invoke("set_settings", {
		data: settings
	});
}
