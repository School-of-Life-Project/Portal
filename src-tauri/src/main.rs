#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::{Context, Result};

mod data;
mod state;

use state::wrapper;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

fn main() -> Result<()> {
    tauri::Builder::default()
        .manage(wrapper::StateWrapper::new())
        .invoke_handler(tauri::generate_handler![
            wrapper::open_data_dir,
            wrapper::get_course,
            wrapper::update_course_progress,
            wrapper::get_course_maps,
            wrapper::get_course_list,
            wrapper::get_active_courses,
            wrapper::set_active_courses,
            wrapper::get_settings,
            wrapper::set_settings,
        ])
        .run(tauri::generate_context!())
        .context("Failed to initalize application window")
}
