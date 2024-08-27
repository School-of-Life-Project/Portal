#![warn(clippy::pedantic)]

use tauri::Manager;

mod api;
mod course;
mod progress;

pub const MAX_FS_CONCURRENCY: usize = 8;

#[allow(clippy::missing_panics_doc)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(api::State::new(
                app.path()
                    .app_data_dir()
                    .expect("Unable to find application data directory"),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::get_data_dir,
            api::get_internal_data_dir,
            api::get_backend_date,
            api::get_course,
            api::set_course_completion,
            api::get_active_courses,
            api::set_active_courses,
            api::get_all,
            api::get_active,
            api::get_overall_progress,
            api::get_settings,
            api::set_settings,
        ])
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("Failed to initalize application window");
}
