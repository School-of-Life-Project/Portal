#![allow(clippy::used_underscore_binding)]

use std::path::PathBuf;

use chrono::{Local, NaiveDate};
use schemars::schema_for;
use serde::Serialize;
use tokio::{sync::OnceCell, task, try_join};
use uuid::Uuid;

mod util;

use util::ErrorWrapper;

use super::{
    course::{storage::DataStore, Course, CourseMap},
    progress::{database::Database, CourseCompletion, CourseProgress, OverallProgress, Settings},
};

pub struct State {
    root: PathBuf,
    database: OnceCell<Database>,
    datastore: OnceCell<DataStore>,
}

impl State {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            database: OnceCell::new(),
            datastore: OnceCell::new(),
        }
    }

    pub async fn get_datastore(&self) -> Result<&DataStore, ErrorWrapper> {
        self.datastore
            .get_or_try_init(|| async {
                let datastore_path = self.root.join("User Resources");
                let schema_path = self.root.join("Resource Schema");

                task::spawn_blocking(move || {
                    std::fs::create_dir_all(&datastore_path).map_err(|e| {
                        ErrorWrapper::new("Unable to create resource folder".to_string(), &e)
                    })?;

                    let course_schema = schema_for!(Course);
                    let course_map_schema = schema_for!(CourseMap);

                    std::fs::create_dir_all(&schema_path).map_err(|e| {
                        ErrorWrapper::new("Unable to write resource schema".to_string(), &e)
                    })?;

                    let course_schema_path = schema_path.join("Course.json");
                    let course_map_schema_path = schema_path.join("CourseMap.json");

                    std::fs::write(
                        course_schema_path,
                        serde_json::to_string_pretty(&course_schema).map_err(|e| {
                            ErrorWrapper::new("Unable to write resource schema".to_string(), &e)
                        })?,
                    )
                    .map_err(|e| {
                        ErrorWrapper::new("Unable to write resource schema".to_string(), &e)
                    })?;
                    std::fs::write(
                        course_map_schema_path,
                        serde_json::to_string_pretty(&course_map_schema).map_err(|e| {
                            ErrorWrapper::new("Unable to write resource schema".to_string(), &e)
                        })?,
                    )
                    .map_err(|e| {
                        ErrorWrapper::new("Unable to write resource schema".to_string(), &e)
                    })?;

                    Ok(DataStore::new(datastore_path))
                })
                .await?
            })
            .await
    }

    pub async fn get_database(&self) -> Result<&Database, ErrorWrapper> {
        self.database
            .get_or_try_init(|| async {
                let database_path = self.root.join("Internal Database");

                task::spawn_blocking(move || {
                    Database::new(&database_path).map_err(|e| {
                        ErrorWrapper::new("Unable to load application database".to_string(), &e)
                    })
                })
                .await?
            })
            .await
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn get_data_dir(state: tauri::State<'_, State>) -> PathBuf {
    state.root.join("User Resources")
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn get_internal_data_dir(state: tauri::State<'_, State>) -> PathBuf {
    state.root.clone()
}

#[tauri::command]
pub fn get_backend_date() -> NaiveDate {
    Local::now().date_naive()
}

#[tauri::command]
pub async fn get_course(
    state: tauri::State<'_, State>,
    uuid: Uuid,
) -> Result<(Course, CourseCompletion), ErrorWrapper> {
    let (course, completion, _) = util::get_course(&state, uuid).await?;

    Ok((course, completion))
}

#[tauri::command]
pub async fn set_course_completion(
    state: tauri::State<'_, State>,
    course: Course,
    completion: CourseCompletion,
) -> Result<(), ErrorWrapper> {
    let uuid = course.uuid.ok_or(ErrorWrapper {
        message: "An internal error occured".to_string(),
        cause: "Course is missing field uuid".to_string(),
    })?;

    state
        .get_database()
        .await?
        .set_course_completion(course, completion)
        .await
        .map_err(|e| ErrorWrapper::new(format!("Unable to update progress for Course {uuid}"), &e))
}

#[tauri::command]
pub async fn get_active_courses(state: tauri::State<'_, State>) -> Result<Vec<Uuid>, ErrorWrapper> {
    util::get_active_courses(&state).await
}

#[tauri::command]
pub async fn set_active_courses(
    state: tauri::State<'_, State>,
    courses: Vec<Uuid>,
) -> Result<(), ErrorWrapper> {
    state
        .get_database()
        .await?
        .set_active_courses(courses)
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update list of active Courses".to_string(), &e))
}

#[tauri::command]
pub async fn get_all(state: tauri::State<'_, State>) -> Result<ListingResult, ErrorWrapper> {
    let scan = state.get_datastore().await?.scan().await.map_err(|e| {
        ErrorWrapper::new("Unable to get Course and CourseMap list".to_string(), &e)
    })?;

    let (courses, course_maps) = try_join!(
        util::get_courses(&state, &scan.courses),
        util::get_course_maps(&state, &scan.course_maps)
    )?;

    Ok(ListingResult {
        courses,
        course_maps,
    })
}

#[derive(Serialize)]
pub struct ListingResult {
    courses: Vec<(Course, CourseProgress)>,
    course_maps: Vec<(CourseMap, String)>,
}

#[tauri::command]
pub async fn get_active(
    state: tauri::State<'_, State>,
) -> Result<Vec<(Course, CourseProgress)>, ErrorWrapper> {
    let scan = util::get_active_courses(&state).await?;
    util::get_courses(&state, &scan).await
}

#[tauri::command]
pub async fn get_overall_progress(
    state: tauri::State<'_, State>,
) -> Result<OverallProgress, ErrorWrapper> {
    state
        .get_database()
        .await?
        .get_overall_progress()
        .await
        .map_err(|e| ErrorWrapper::new("Unable to get overall progress".to_string(), &e))
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, State>) -> Result<Settings, ErrorWrapper> {
    state
        .get_database()
        .await?
        .get_settings()
        .await
        .map_err(|e| ErrorWrapper::new("Unable to get Settings".to_string(), &e))
}

#[tauri::command]
pub async fn set_settings(
    state: tauri::State<'_, State>,
    settings: Option<Settings>,
) -> Result<(), ErrorWrapper> {
    state
        .get_database()
        .await?
        .set_settings(settings.unwrap_or_default())
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update Settings".to_string(), &e))
}
