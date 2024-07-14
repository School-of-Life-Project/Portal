#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![warn(clippy::pedantic)]

use anyhow::{Context, Result};

mod api;
mod data;

use api::wrapper;

pub const MAX_FS_CONCURRENCY: usize = 8;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

const PROJECT_ISSUE_TRACKER: &str = "https://github.com/School-of-Life-Project/Portal-App/issues";
const PROJECT_ISSUE_TRACKER_NEW: &str =
    "https://github.com/School-of-Life-Project/Portal-App/issues/new";
const PROJECT_SOURCE_REPO: &str = "https://github.com/School-of-Life-Project/Portal-App";

fn main() -> Result<()> {
    tauri::Builder::default()
        .manage(wrapper::StateWrapper::new())
        .invoke_handler(tauri::generate_handler![
            wrapper::open_data_dir,
            wrapper::open_project_issue_tracker,
            wrapper::open_project_repo,
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
