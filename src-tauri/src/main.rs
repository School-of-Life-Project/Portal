#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![warn(clippy::pedantic)]

use anyhow::{Context, Result};

mod api;
mod data;

use api::wrapper;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

fn main() -> Result<()> {
    tauri::Builder::default()
        .manage(wrapper::StateWrapper::new())
        .invoke_handler(tauri::generate_handler![
            wrapper::open_data_dir,
            wrapper::get_course_maps,
            wrapper::get_courses,
            wrapper::get_courses_active,
            wrapper::get_course,
            wrapper::set_course_completion,
            wrapper::set_course_active_status,
            wrapper::get_overall_progress,
            wrapper::get_settings,
            wrapper::set_settings,
        ])
        .run(tauri::generate_context!())
        .context("Failed to initalize application window")
}
