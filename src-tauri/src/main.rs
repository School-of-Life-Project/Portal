#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::{Context, Result};

mod data;
mod state;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

fn main() -> Result<()> {
    tauri::Builder::default()
        .manage(state::wrapper::StateWrapper::new())
        .invoke_handler(tauri::generate_handler![
            state::open_data_dir,
            state::get_course_map_list,
            state::get_course_map,
            state::get_course_list,
            state::get_course,
            state::get_course_progress,
            state::set_course_progress,
            state::get_active_courses,
            state::set_active_courses,
            state::get_settings,
            state::set_settings,
        ])
        .run(tauri::generate_context!())
        .context("Failed to initalize application window")
}
