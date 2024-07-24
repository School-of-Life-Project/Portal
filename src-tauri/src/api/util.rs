use futures_util::future::try_join_all;
use serde::Serialize;
use tokio::task::JoinError;
use uuid::Uuid;

use crate::MAX_FS_CONCURRENCY;

use super::{
    super::{
        course::{Course, CourseMap},
        progress::{CourseCompletion, CourseProgress},
    },
    State,
};

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

pub(super) async fn get_course(
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

pub(super) async fn get_courses(
    state: &State,
    ids: &[Uuid],
) -> Result<Vec<(Course, CourseProgress)>, ErrorWrapper> {
    let mut hydrated_courses = Vec::with_capacity(ids.len());

    for chunk in ids.chunks(MAX_FS_CONCURRENCY) {
        let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY);

        for uuid in chunk {
            future_set.push(get_course(state, *uuid));
        }

        let results = try_join_all(future_set).await?;

        for result in results {
            hydrated_courses.push((result.0, result.2));
        }
    }

    Ok(hydrated_courses)
}

pub(super) async fn get_active_courses(state: &State) -> Result<Vec<Uuid>, ErrorWrapper> {
    state
        .database
        .get_active_courses()
        .await
        .map_err(|e| ErrorWrapper::new("Unable to get list of active Courses".to_string(), &e))
}

pub(super) async fn get_course_maps(
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
