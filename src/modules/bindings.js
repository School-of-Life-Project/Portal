export function openDataDir() {
	return window.__TAURI_INVOKE__("open_data_dir");
}

export function getCourseMaps() {
	return window.__TAURI_INVOKE__("get_course_maps");
}

export function getCourses() {
	return window.__TAURI_INVOKE__("get_courses").then((courses) => {
		if (Array.isArray(courses)) {
			for (const course in courses) {
				normalizeCourse(course);
			}
		}
		return courses;
	});
}

export function getCoursesActive() {
	return window.__TAURI_INVOKE__("get_courses_active").then((courses) => {
		if (Array.isArray(courses)) {
			for (const course in courses) {
				normalizeCourse(course);
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
			normalizeCourse(course);
			return course;
		});
}

function normalizeCourse(course) {
	if (course.books) {
		for (const book in course.books) {
			book.file = window.__TAURI__.convertFileSrc(book.file);
		}
	}
}

export function setCourseCompletion(uuid, completion) {
	return window.__TAURI_INVOKE__("set_course_completion", {
		id: uuid,
		data: completion
	});
}

export function setCourseActiveStatus(uuid, active) {
	return window.__TAURI_INVOKE__("get_course_active_status", {
		id: uuid,
		data: active
	});
}

export function getOverallProgress() {
	return window.__TAURI_INVOKE__("get_overall_progress");
}

export function getSettings() {
	return window.__TAURI_INVOKE__("get_settings");
}

export function setSettings(settings) {
	return window.__TAURI_INVOKE__("set_settings", {
		data: settings
	});
}
