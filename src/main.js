const invoke = window.__TAURI_INVOKE__;

function open_data_dir() {
	return invoke('open_data_dir');
}

function get_course_maps() {
	return invoke('get_course_maps');
}

function get_courses() {
	return invoke('get_courses');
}

function get_courses_active() {
	return invoke('get_courses_active');
}

function get_course(uuid) {
	return invoke('get_course', { id: uuid });
}

function set_course_completion(uuid, completion) {
	return invoke('set_course_completion', { id: uuid, data: completion });
}

function set_course_active_status(uuid, active) {
	return invoke('get_course_active_status', { id: uuid, data: active });
}

function get_overall_progress() {
	return invoke('get_overall_progress');
}

function get_settings() {
	return invoke('get_settings');
}

function set_settings(settings) {
	return invoke('set_settings', { data: settings });
}

// convertFileSrc