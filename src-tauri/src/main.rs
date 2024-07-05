#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::{Context, Result};

mod course;
mod data;

const IDENTIFIER: &str = "com.schoolOfLifeProject.Portal";

fn main() -> Result<()> {
    tauri::Builder::default()
        .manage(course::StateWrapper::new())
        .invoke_handler(tauri::generate_handler![course::open_data_dir])
        .run(tauri::generate_context!())
        .context("Failed to initalize application window")
}
