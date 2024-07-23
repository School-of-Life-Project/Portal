use std::{
    collections::HashSet,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
};

use futures_util::future::try_join_all;
use serde::Deserialize;
use thiserror::Error;
use tokio::{
    fs::{self, read_dir},
    io::{self, ErrorKind},
    task::{self, JoinError},
};
use toml::Deserializer;
use uuid::{fmt::Simple, Uuid};
use zip::{result::ZipError, ZipArchive};

use crate::MAX_FS_CONCURRENCY;

use super::{Course, CourseMap};

#[derive(Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error(transparent)]
    Deserialization(#[from] toml::de::Error),
    #[error("Task was terminated or panicked")]
    BlockingTaskFailed(#[from] JoinError),
    #[error(transparent)]
    Decompression(#[from] ZipError),
}

async fn unzip(input: PathBuf, tmp: PathBuf, dest: PathBuf) -> Result<(), Error> {
    task::spawn_blocking(move || -> Result<_, Error> {
        {
            let file = std::fs::File::open(&input)?;
            let mut archive = ZipArchive::new(file)?;

            match archive.extract(&tmp) {
                Ok(()) => {}
                Err(ZipError::Io(io_error)) => return Err(Error::Io(io_error)),
                Err(error) => {
                    std::fs::remove_dir_all(tmp)?;
                    return Err(Error::Decompression(error));
                }
            }
        }

        std::fs::rename(tmp, dest)?;
        std::fs::remove_file(input)?;

        Ok(())
    })
    .await?
}

async fn unpack_dir(path: &Path) -> Result<(), Error> {
    let mut paths = Vec::new();

    let temp_extension = OsStr::new("temp");
    let zip_extension = OsStr::new("zip");

    {
        let mut read_dir = read_dir(path).await?;

        while let Some(entry) = read_dir.next_entry().await? {
            let path = entry.path();
            let extension = path.extension().map(OsStr::to_ascii_lowercase);

            if extension == Some(temp_extension.into()) {
                let metadata = entry.metadata().await?;

                if metadata.is_dir() {
                    fs::remove_file(path).await?;
                } else if metadata.is_file() {
                    fs::remove_dir_all(path).await?;
                }
            } else if extension == Some(zip_extension.into()) {
                let metadata = entry.metadata().await?;

                if metadata.is_file() {
                    paths.push(path);
                }
            }
        }
    }

    for path_chunk in paths.chunks(MAX_FS_CONCURRENCY) {
        let mut future_set = Vec::with_capacity(MAX_FS_CONCURRENCY);

        for path in path_chunk {
            future_set.push(unzip(
                path.clone(),
                path.with_extension(temp_extension),
                path.with_extension(""),
            ));
        }

        try_join_all(future_set).await?;
    }

    Ok(())
}

struct DirScanResults {
    files: HashSet<Uuid>,
    folders: HashSet<Uuid>,
}

async fn scan_dir(path: &Path) -> Result<DirScanResults, Error> {
    let mut read_dir = read_dir(path).await?;

    let mut results = DirScanResults {
        files: HashSet::new(),
        folders: HashSet::new(),
    };

    let toml_extension = Some(OsString::from("toml"));

    let mut buffer = Uuid::encode_buffer();

    while let Some(entry) = read_dir.next_entry().await? {
        let path = entry.path();
        let extension = path.extension();
        let filename = path.file_name().unwrap_or_default().to_string_lossy();
        let filestem = path.file_stem().unwrap_or_default().to_string_lossy();

        let uuid = Uuid::try_parse(&filestem).unwrap_or_else(|_| Uuid::new_v4());
        let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

        if extension.is_none() {
            let metadata = entry.metadata().await?;

            if !metadata.is_dir() {
                continue;
            }

            if *formatted != *filename {
                let new_path = path.with_file_name(formatted);
                fs::rename(path, new_path).await?;
            }

            if results.folders.contains(&uuid) {
                return Err(Error::Io(io::Error::from(ErrorKind::AlreadyExists)));
            }

            results.folders.insert(uuid);
        } else if extension.map(OsStr::to_ascii_lowercase) == toml_extension {
            let metadata = entry.metadata().await?;

            if !metadata.is_file() {
                continue;
            }

            if *formatted != *filestem || extension != toml_extension.as_deref() {
                let mut new_path = path.with_file_name(formatted);
                new_path.set_extension(extension.unwrap_or_default());
                fs::rename(path, new_path).await?;
            }

            if results.files.contains(&uuid) {
                return Err(Error::Io(io::Error::from(ErrorKind::AlreadyExists)));
            }

            results.files.insert(uuid);
        }
    }

    Ok(results)
}

pub struct DataStore {
    pub root: PathBuf,
}

impl DataStore {
    pub async fn get_course(&self, id: &Uuid) -> Result<Course, Error> {
        let root = self
            .root
            .join(Simple::from_uuid(*id).encode_lower(&mut Uuid::encode_buffer()));

        let index_path = root.join("course.toml");

        let data = fs::read_to_string(index_path).await?;
        let deserializer = Deserializer::new(&data);

        let mut index = Course::deserialize(deserializer)?;
        index.uuid = *id;
        index.make_paths_relative();

        for book in &mut index.books {
            book.file = fs::canonicalize(root.join(&book.file)).await?;
        }

        Ok(index)
    }

    pub async fn get_course_map(&self, id: &Uuid) -> Result<CourseMap, Error> {
        let mut path = self
            .root
            .join(Simple::from_uuid(*id).encode_lower(&mut Uuid::encode_buffer()));
        path.set_extension("toml");

        let data = fs::read_to_string(path).await?;
        let deserializer = Deserializer::new(&data);

        let mut data = CourseMap::deserialize(deserializer)?;
        data.uuid = *id;

        Ok(data)
    }

    pub async fn scan(&self) -> Result<ScanResult, Error> {
        unpack_dir(&self.root).await?;

        let scan = scan_dir(&self.root).await?;

        Ok(ScanResult {
            courses: scan.files,
            course_maps: scan.folders,
        })
    }
}

pub struct ScanResult {
    pub courses: HashSet<Uuid>,
    pub course_maps: HashSet<Uuid>,
}
