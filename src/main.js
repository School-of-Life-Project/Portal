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
	return invoke('get_course', uuid);
}

function get_settings() {
	return invoke('get_settings');
}

function set_settings(settings) {
	return invoke('set_settings', { data: settings });
}

// convertFileSrc