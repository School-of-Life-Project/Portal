use std::{ops::Deref, path::Path};

use sled::{
    transaction::{ConflictableTransactionError, TransactionError},
    Config, Db,
};
use thiserror::Error;
use tokio::task::{self, JoinError};
use uuid::Uuid;

use super::{super::course::Course, CourseCompletion, CourseProgress, OverallProgress, Settings};

#[derive(Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Storage(#[from] sled::Error),
    #[error(transparent)]
    Encoding(#[from] bincode::Error),
    #[error("Task was terminated or panicked")]
    BlockingTaskFailed(#[from] JoinError),
}

impl From<TransactionError<bincode::Error>> for Error {
    fn from(value: TransactionError<bincode::Error>) -> Self {
        match value {
            TransactionError::Abort(abort) => Self::Encoding(abort),
            TransactionError::Storage(error) => Self::Storage(error),
        }
    }
}

#[derive(Clone)]
pub struct Database {
    root: Db,
}

const SETTINGS_KEY: &[u8] = b"settings";
const ACTIVE_COURSES_KEY: &[u8] = b"active_courses";
const PROGRESS_TREE_KEY: &[u8] = b"course_progress";
const OVERALL_PROGRESS_KEY: &[u8] = b"overall"; // Must have a length not equal to 16 bytes.

impl Database {
    // Application initialization is done before an async runtime is initalized
    pub fn new(root: &Path) -> Result<Database, Error> {
        let config = Config::new().path(root);

        Ok(Database {
            root: /*task::spawn_blocking(move || */config.open()/*).await?*/?,
        })
    }
    pub async fn get_course_progress(
        &self,
        course: Course,
    ) -> Result<(Course, CourseCompletion, CourseProgress), Error> {
        let progress_tree = self.root.open_tree(PROGRESS_TREE_KEY)?;

        task::spawn_blocking(move || {
            let completion = if let Some(data) = progress_tree.get(course.uuid.as_bytes())? {
                bincode::deserialize(&data)?
            } else {
                CourseCompletion::default()
            };

            let progress = CourseProgress::calculate(&course, &completion);

            Ok((course, completion, progress))
        })
        .await?
    }
    pub async fn set_course_completion(
        &self,
        course: Course,
        data: CourseCompletion,
    ) -> Result<(), Error> {
        let progress_tree = self.root.open_tree(PROGRESS_TREE_KEY)?;

        task::spawn_blocking(move || {
            progress_tree.transaction(|progress_tree| {
                let old_completion =
                    if let Some(data) = progress_tree.get(course.uuid.as_bytes())? {
                        bincode::deserialize(&data).map_err(ConflictableTransactionError::Abort)?
                    } else {
                        CourseCompletion::default()
                    };

                let old_progress = CourseProgress::calculate(&course, &old_completion);
                let new_progress = CourseProgress::calculate(&course, &data);

                progress_tree.insert(
                    course.uuid.as_bytes(),
                    bincode::serialize(&data).map_err(ConflictableTransactionError::Abort)?,
                )?;

                let time_change_secs =
                    CourseCompletion::calculate_time_diff_secs(&old_completion, &data);
                let chapter_change =
                    CourseProgress::calculate_chapter_diff(&old_progress, &new_progress);

                let mut overall = if let Some(data) = progress_tree.get(OVERALL_PROGRESS_KEY)? {
                    bincode::deserialize(&data).map_err(ConflictableTransactionError::Abort)?
                } else {
                    OverallProgress::default()
                };
                overall.update(chapter_change, time_change_secs);

                progress_tree.insert(
                    OVERALL_PROGRESS_KEY,
                    bincode::serialize(&overall).map_err(ConflictableTransactionError::Abort)?,
                )?;

                Ok(())
            })?;

            Ok(())
        })
        .await?
    }
    pub async fn get_overall_progress(&self) -> Result<OverallProgress, Error> {
        let progress_tree = self.root.open_tree(PROGRESS_TREE_KEY)?;

        task::spawn_blocking(move || {
            if let Some(data) = progress_tree.get(OVERALL_PROGRESS_KEY)? {
                Ok(bincode::deserialize(&data)?)
            } else {
                Ok(OverallProgress::default())
            }
        })
        .await?
    }
    pub async fn get_active_courses(&self) -> Result<Vec<Uuid>, Error> {
        let root_tree = self.root.deref().clone();

        task::spawn_blocking(move || {
            if let Some(data) = root_tree.get(ACTIVE_COURSES_KEY)? {
                Ok(bincode::deserialize(&data)?)
            } else {
                Ok(Vec::new())
            }
        })
        .await?
    }
    pub async fn set_active_courses(&self, data: Vec<Uuid>) -> Result<(), Error> {
        let root_tree = self.root.deref().clone();

        task::spawn_blocking(move || {
            root_tree.insert(ACTIVE_COURSES_KEY, bincode::serialize(&data)?)?;

            Ok(())
        })
        .await?
    }
    pub async fn get_settings(&self) -> Result<Settings, Error> {
        let root_tree = self.root.deref().clone();

        task::spawn_blocking(move || {
            if let Some(data) = root_tree.get(SETTINGS_KEY)? {
                Ok(bincode::deserialize(&data)?)
            } else {
                Ok(Settings::default())
            }
        })
        .await?
    }
    pub async fn set_settings(&self, data: Settings) -> Result<(), Error> {
        let root_tree = self.root.deref().clone();

        task::spawn_blocking(move || {
            root_tree.insert(SETTINGS_KEY, bincode::serialize(&data)?)?;

            Ok(())
        })
        .await?
    }
}
