use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tokio::{
    fs::{self, ReadDir},
    io,
};

use crate::data;

#[derive(Serialize, Deserialize, Debug)]
pub struct Course {
    title: String,
    description: Option<String>,
    books: Vec<(String, Textbook)>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Textbook {
    file: PathBuf,
    chapters: Vec<Chapter>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Chapter {
    id: Option<String>,
    sections: Vec<Vec<String>>,
}

#[tauri::command]
pub async fn get_courses(
    window: tauri::Window,
    app_handle: tauri::AppHandle,
) -> Result<Vec<Course>, String> {
    let mut path =
        data::get_data_dir(app_handle).ok_or("Unable to find application data directory")?;
    path.push("courses");

    //for entry in fs::read_dir(data_dir).await {}

    //println!("{:?}", data_dir);

    //println!("I was invoked from JS!");

    //return Ok(Vec::new());

    todo!();
}
