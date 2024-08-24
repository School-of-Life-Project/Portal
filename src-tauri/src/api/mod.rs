#![allow(clippy::used_underscore_binding)]

use std::path::PathBuf;

use schemars::schema_for;
use serde::Serialize;
use tokio::try_join;
use uuid::Uuid;

mod util;

use util::ErrorWrapper;

use super::{
    course::{storage::DataStore, Course, CourseMap},
    progress::{database::Database, CourseCompletion, CourseProgress, OverallProgress, Settings},
};

pub struct State {
    root: PathBuf,
    database: Database,
    datastore: DataStore,
}

impl State {
    pub fn new(root: PathBuf) -> Result<Self, anyhow::Error> {
        let database_path = root.join("Internal Database");
        let datastore_path = root.join("User Resources");

        let course_schema = schema_for!(Course);
        let course_map_schema = schema_for!(CourseMap);

        std::fs::create_dir_all(&datastore_path)?;

        let schema_path = root.join("Resource Schema");

        std::fs::create_dir_all(&schema_path)?;

        let course_schema_path = schema_path.join("Course.json");
        let course_map_schema_path = schema_path.join("CourseMap.json");

        std::fs::write(
            course_schema_path,
            serde_json::to_string_pretty(&course_schema)?,
        )?;
        std::fs::write(
            course_map_schema_path,
            serde_json::to_string_pretty(&course_map_schema)?,
        )?;

        Ok(Self {
            root,
            database: Database::new(&database_path)?,
            datastore: DataStore {
                root: datastore_path,
            },
        })
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn open_data_dir(state: tauri::State<'_, State>) -> Result<(), ErrorWrapper> {
    open::that_detached(&state.datastore.root).map_err(|e| {
        ErrorWrapper::new(
            format!("Unable to launch OS opener for {:?}", &state.datastore.root),
            &e,
        )
    })?;

    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn open_internal_data_dir(state: tauri::State<'_, State>) -> Result<(), ErrorWrapper> {
    open::that_detached(&state.root).map_err(|e| {
        ErrorWrapper::new(
            format!("Unable to launch OS opener for {:?}", &state.root),
            &e,
        )
    })?;

    Ok(())
}

#[tauri::command]
pub fn open_project_issue_tracker(data: bool) -> Result<(), ErrorWrapper> {
    #[allow(clippy::match_bool)]
    let url = match data {
        true => crate::PROJECT_ISSUE_TRACKER_NEW,
        false => crate::PROJECT_ISSUE_TRACKER,
    };
    open::that_detached(url)
        .map_err(|e| ErrorWrapper::new(format!("Unable to launch OS opener for {:?}", &url), &e))?;

    Ok(())
}

#[tauri::command]
pub fn open_project_repo() -> Result<(), ErrorWrapper> {
    open::that_detached(crate::PROJECT_SOURCE_REPO).map_err(|e| {
        ErrorWrapper::new(
            format!(
                "Unable to launch OS opener for {:?}",
                &crate::PROJECT_SOURCE_REPO
            ),
            &e,
        )
    })?;

    Ok(())
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
        message: "Unable to parse Course!".to_string(),
        cause: "Missing field uuid".to_string(),
    })?;

    state
        .database
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
        .database
        .set_active_courses(courses)
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update list of active Courses".to_string(), &e))
}

#[tauri::command]
pub async fn get_all(state: tauri::State<'_, State>) -> Result<ListingResult, ErrorWrapper> {
    let scan =
        state.datastore.scan().await.map_err(|e| {
            ErrorWrapper::new("Unable to get Course/CourseMap list".to_string(), &e)
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
        .database
        .get_overall_progress()
        .await
        .map_err(|e| ErrorWrapper::new("Unable to get overall progress".to_string(), &e))
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, State>) -> Result<Settings, ErrorWrapper> {
    state
        .database
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
        .database
        .set_settings(settings.unwrap_or_default())
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update Settings".to_string(), &e))
}
