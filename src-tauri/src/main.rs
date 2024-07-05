#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod course;
mod data;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

fn main() {
    tauri::Builder::default()
        .manage(course::StateWrapper::new())
        .invoke_handler(tauri::generate_handler![
            course::open_data_dir,
            course::get_courses
        ])
        .run(tauri::generate_context!())
        .expect("error when starting application");
}
