#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod course;
mod data;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            data::open_data_dir,
            course::get_courses
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
