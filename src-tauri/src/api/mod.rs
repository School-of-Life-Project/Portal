#![allow(clippy::used_underscore_binding)]

use anyhow::anyhow;
use futures_util::try_join;
use serde::Serialize;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

mod util;

use util::ErrorWrapper;

use super::{
    course::{storage::DataStore, Course, CourseMap},
    progress::{database::Database, CourseCompletion, CourseProgress, OverallProgress, Settings},
};

pub struct State {
    database: Database,
    datastore: DataStore,
}

impl State {
    pub fn new(handle: &AppHandle) -> Result<Self, anyhow::Error> {
        let root = handle
            .path_resolver()
            .app_data_dir()
            .ok_or_else(|| anyhow!("Unable to find data_dir"))?;

        Ok(Self {
            database: Database::new(&root.join("database"))?,
            datastore: DataStore {
                root: root.join("Courses and Course Maps"),
            },
        })
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn open_data_dir(handle: AppHandle) -> Result<(), ErrorWrapper> {
    if let Some(path) = handle.path_resolver().app_data_dir() {
        open::that_detached(&path).map_err(|e| {
            ErrorWrapper::new(format!("Unable to launch OS opener for {:?}", &path), &e)
        })?;
    }

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
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, State>,
    id: Uuid,
) -> Result<(Course, CourseCompletion), ErrorWrapper> {
    let (course, completion, _) = util::get_course(&state, id).await?;

    let scope = app_handle.asset_protocol_scope();

    for book in &course.books {
        scope.allow_directory(&book.file, true).map_err(|e| {
            ErrorWrapper::new(
                format!("Unable to update permissions for path {:?}", book.file),
                &e,
            )
        })?;
    }

    Ok((course, completion))
}

#[tauri::command]
pub async fn set_course_completion(
    state: tauri::State<'_, State>,
    course: Course,
    data: CourseCompletion,
) -> Result<(), ErrorWrapper> {
    let uuid = course.uuid;

    state
        .database
        .set_course_completion(course, data)
        .await
        .map_err(|e| ErrorWrapper::new(format!("Unable to update progress for Course {uuid}"), &e))
}

#[tauri::command]
pub async fn set_active_courses(
    state: tauri::State<'_, State>,
    data: Vec<Uuid>,
) -> Result<(), ErrorWrapper> {
    state
        .database
        .set_active_courses(data)
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update list of active Courses".to_string(), &e))
}

#[tauri::command]
pub async fn get_listing(state: tauri::State<'_, State>) -> Result<ListingResult, ErrorWrapper> {
    let scan =
        state.datastore.scan().await.map_err(|e| {
            ErrorWrapper::new("Unable to get Course/CourseMap list".to_string(), &e)
        })?;

    let (courses, course_maps, settings) = try_join!(
        util::get_courses(&state, &scan.courses),
        util::get_course_maps(&state, &scan.course_maps),
        util::get_settings(&state)
    )?;

    Ok(ListingResult {
        courses,
        course_maps,
        settings,
    })
}

#[derive(Serialize)]
pub struct ListingResult {
    courses: Vec<(Course, CourseProgress)>,
    course_maps: Vec<(CourseMap, String)>,
    settings: Settings,
}

#[tauri::command]
pub async fn get_overview(state: tauri::State<'_, State>) -> Result<OverviewResult, ErrorWrapper> {
    let scan =
        state.database.get_active_courses().await.map_err(|e| {
            ErrorWrapper::new("Unable to get list of active Courses".to_string(), &e)
        })?;

    let (active_courses, overall_progress, settings) = try_join!(
        util::get_courses(&state, &scan),
        util::get_overall_progress(&state),
        util::get_settings(&state)
    )?;

    Ok(OverviewResult {
        active_courses,
        overall_progress,
        settings,
    })
}

#[derive(Serialize)]
pub struct OverviewResult {
    active_courses: Vec<(Course, CourseProgress)>,
    overall_progress: OverallProgress,
    settings: Settings,
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, State>) -> Result<Settings, ErrorWrapper> {
    util::get_settings(&state).await
}

#[tauri::command]
pub async fn set_settings(
    state: tauri::State<'_, State>,
    data: Settings,
) -> Result<(), ErrorWrapper> {
    state
        .database
        .set_settings(data)
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update Settings".to_string(), &e))
}
