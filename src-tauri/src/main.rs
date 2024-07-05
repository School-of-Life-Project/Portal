#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tokio::task;

mod course;
mod data;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

#[tokio::main]
async fn main() {
    let state = course::State::new()
        .await
        .expect("error when initalizing application directories");

    task::spawn_blocking(move || {
        tauri::Builder::default()
            .manage(state)
            .invoke_handler(tauri::generate_handler![
                //data::open_data_dir,
                course::get_courses
            ])
            .run(tauri::generate_context!())
    })
    .await
    .expect("error when starting tauri task")
    .expect("error when starting tauri");
}
