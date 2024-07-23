use std::path::Path;

use sled::{
    transaction::{ConflictableTransactionError, TransactionError},
    Config, Db,
};
use thiserror::Error;
use uuid::Uuid;

use super::{super::course::Course, CourseCompletion, CourseProgress, OverallProgress, Settings};

#[derive(Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Storage(#[from] sled::Error),
    #[error(transparent)]
    Encoding(#[from] bincode::Error),
}

impl From<TransactionError<bincode::Error>> for Error {
    fn from(value: TransactionError<bincode::Error>) -> Self {
        match value {
            TransactionError::Abort(abort) => Self::Encoding(abort),
            TransactionError::Storage(error) => Self::Storage(error),
        }
    }
}

pub struct Database {
    root: Db,
}

const SETTINGS_KEY: &[u8] = b"settings";
const ACTIVE_COURSES_KEY: &[u8] = b"active_courses";
const PROGRESS_TREE_KEY: &[u8] = b"course_progress";
const OVERALL_PROGRESS_KEY: &[u8] = b"overall"; // Must have a length not equal to 16 bytes.

impl Database {
    pub fn new(root: &Path) -> Result<Database, Error> {
        let database = Config::new().path(root).open()?;

        Ok(Database { root: database })
    }
    pub fn get_course_progress(
        &self,
        course: &Course,
    ) -> Result<(CourseCompletion, CourseProgress), Error> {
        let progress_tree = self.root.open_tree(PROGRESS_TREE_KEY)?;

        let completion = if let Some(data) = progress_tree.get(course.uuid.as_bytes())? {
            bincode::deserialize(&data)?
        } else {
            CourseCompletion::default()
        };

        let progress = CourseProgress::calculate(course, &completion);

        Ok((completion, progress))
    }
    pub fn set_course_completion(
        &self,
        course: &Course,
        data: &CourseCompletion,
    ) -> Result<(), Error> {
        let progress_tree = self.root.open_tree(PROGRESS_TREE_KEY)?;

        progress_tree.transaction(|progress_tree| {
            let old_completion = if let Some(data) = progress_tree.get(course.uuid.as_bytes())? {
                bincode::deserialize(&data).map_err(ConflictableTransactionError::Abort)?
            } else {
                CourseCompletion::default()
            };

            let old_progress = CourseProgress::calculate(course, &old_completion);
            let new_progress = CourseProgress::calculate(course, data);

            progress_tree.insert(
                course.uuid.as_bytes(),
                bincode::serialize(data).map_err(ConflictableTransactionError::Abort)?,
            )?;

            let time_change_secs =
                CourseCompletion::calculate_time_diff_secs(&old_completion, data);
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
    }
    pub fn get_overall_progress(&self) -> Result<OverallProgress, Error> {
        let progress_tree = self.root.open_tree(PROGRESS_TREE_KEY)?;

        if let Some(data) = progress_tree.get(OVERALL_PROGRESS_KEY)? {
            Ok(bincode::deserialize(&data)?)
        } else {
            Ok(OverallProgress::default())
        }
    }
    pub fn get_active_courses(&self) -> Result<Vec<Uuid>, Error> {
        if let Some(data) = self.root.get(ACTIVE_COURSES_KEY)? {
            Ok(bincode::deserialize(&data)?)
        } else {
            Ok(Vec::new())
        }
    }
    pub fn set_active_courses(&self, data: &[Uuid]) -> Result<(), Error> {
        self.root
            .insert(ACTIVE_COURSES_KEY, bincode::serialize(data)?)?;

        Ok(())
    }
    pub fn get_settings(&self) -> Result<Settings, Error> {
        if let Some(data) = self.root.get(SETTINGS_KEY)? {
            Ok(bincode::deserialize(&data)?)
        } else {
            Ok(Settings::default())
        }
    }
    pub fn set_settings(&self, data: &Settings) -> Result<(), Error> {
        self.root.insert(SETTINGS_KEY, bincode::serialize(data)?)?;

        Ok(())
    }
}
