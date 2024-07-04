use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::{
    fs::{self, ReadDir},
    io,
};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct Course {
    title: String,
    description: Option<String>,
    books: Vec<CourseBook>,
}

#[derive(Serialize, Deserialize, Debug)]
struct CourseBook {
    title: String,
    resource: Uuid,
}

#[derive(Serialize, Deserialize, Debug)]
struct Textbook {
    id: Uuid,
    chapters: Vec<Chapter>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Chapter {
    id: Option<String>,
    sections: Vec<Vec<String>>,
}

async fn ensure_folder_exists(path: &Path) -> io::Result<()> {
    if !path.exists() {
        fs::create_dir_all(path).await?;
    } else if !path.is_dir() {
        fs::remove_file(path).await?;
        fs::create_dir_all(path).await?;
    }

    Ok(())
}

async fn get_path_iterator(path: &Path) -> io::Result<ReadDir> {
    ensure_folder_exists(path).await?;

    fs::read_dir(path).await
}

#[tauri::command]
pub async fn open_data_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Unable to find application data directory")?;

    ensure_folder_exists(&path)
        .await
        .map_err(|err| format!("Unable to open application data directory: {}", err))?;

    open::that_detached(&path)
        .map_err(|err| format!("Unable to launch system file opener: {}", err))
}

#[tauri::command]
pub async fn get_courses(
    window: tauri::Window,
    app_handle: tauri::AppHandle,
) -> Result<Vec<Course>, String> {
    let mut path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Unable to find application data directory")?;
    path.push("courses");

    let dir_iterator = get_path_iterator(&path)
        .await
        .map_err(|err| format!("Unable to open application data directory: {}", err));

    //for entry in fs::read_dir(data_dir).await {}

    //println!("{:?}", data_dir);

    //println!("I was invoked from JS!");

    //return Ok(Vec::new());

    todo!();
}
