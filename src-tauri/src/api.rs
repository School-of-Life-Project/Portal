#![allow(clippy::used_underscore_binding)]

use anyhow::anyhow;
use futures_util::{future::try_join_all, try_join};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::task::JoinError;
use uuid::Uuid;

use super::{
    course::{storage::DataStore, Course, CourseMap},
    progress::{database::Database, CourseCompletion, CourseProgress, OverallProgress, Settings},
};

use crate::MAX_FS_CONCURRENCY;

// TODO: Further refactor the internal API to reduce number of function calls

#[derive(Serialize)]
pub struct ErrorWrapper {
    pub(super) message: String,
    pub(super) cause: String,
}

impl ErrorWrapper {
    pub(super) fn new<T>(message: String, inner: &T) -> Self
    where
        T: std::error::Error,
    {
        Self {
            message,
            cause: format!("{inner}"),
        }
    }
}

impl From<JoinError> for ErrorWrapper {
    fn from(value: JoinError) -> Self {
        Self::new("An internal error occured".to_string(), &value)
    }
}

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

async fn get_hydrated_course(
    state: &State,
    id: Uuid,
) -> Result<(Course, CourseCompletion, CourseProgress), ErrorWrapper> {
    let course = state
        .datastore
        .get_course(id)
        .await
        .map_err(|e| ErrorWrapper::new(format!("Unable to get Course {id}"), &e))?;

    state
        .database
        .get_course_progress(course)
        .await
        .map_err(|e| ErrorWrapper::new(format!("Unable to get progress for Course {id}"), &e))
}

async fn get_courses(
    state: &State,
    ids: &[Uuid],
) -> Result<Vec<(Course, CourseProgress)>, ErrorWrapper> {
    let mut hydrated_courses = Vec::with_capacity(ids.len());

    for chunk in ids.chunks(MAX_FS_CONCURRENCY) {
        let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY);

        for uuid in chunk {
            future_set.push(get_hydrated_course(state, *uuid));
        }

        let results = try_join_all(future_set).await?;

        for result in results {
            hydrated_courses.push((result.0, result.2));
        }
    }

    Ok(hydrated_courses)
}

async fn get_course_maps(
    state: &State,
    ids: &[Uuid],
) -> Result<Vec<(CourseMap, String)>, ErrorWrapper> {
    let mut course_maps = Vec::with_capacity(ids.len());

    for chunk in ids.chunks(MAX_FS_CONCURRENCY) {
        let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY);

        for uuid in chunk {
            future_set.push(async {
                let uuid = *uuid;

                state
                    .datastore
                    .get_course_map(uuid)
                    .await
                    .map_err(|e| ErrorWrapper::new(format!("Unable to get Course Map {uuid}"), &e))
            });
        }

        let mut results = try_join_all(future_set).await?;

        course_maps.append(&mut results);
    }

    Ok(course_maps)
}

#[tauri::command]
pub async fn get_course(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, State>,
    id: Uuid,
) -> Result<(Course, CourseCompletion), ErrorWrapper> {
    let (course, completion, _) = get_hydrated_course(&state, id).await?;

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
pub async fn get_active_courses(
    state: tauri::State<'_, State>,
) -> Result<Vec<(Course, CourseProgress)>, ErrorWrapper> {
    let active_courses =
        state.database.get_active_courses().await.map_err(|e| {
            ErrorWrapper::new("Unable to get list of active Courses".to_string(), &e)
        })?;

    get_courses(&state, &active_courses).await
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
pub async fn get_all(state: tauri::State<'_, State>) -> Result<ListingResult, ErrorWrapper> {
    let scan =
        state.datastore.scan().await.map_err(|e| {
            ErrorWrapper::new("Unable to get Course/CourseMap list".to_string(), &e)
        })?;

    let (courses, course_maps) = try_join!(
        get_courses(&state, &scan.courses),
        get_course_maps(&state, &scan.course_maps)
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
    data: Settings,
) -> Result<(), ErrorWrapper> {
    state
        .database
        .set_settings(data)
        .await
        .map_err(|e| ErrorWrapper::new("Unable to update Settings".to_string(), &e))
}
