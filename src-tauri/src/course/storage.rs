use std::{
    collections::HashSet,
    ffi::OsStr,
    fs::{self, File},
    io::{self, ErrorKind},
    path::PathBuf,
    sync::Arc,
};

use serde::Deserialize;
use thiserror::Error;
use tokio::task::{self, JoinError, JoinSet};
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

async fn get_dir_entries(path: PathBuf) -> Result<Vec<PathBuf>, Error> {
    task::spawn_blocking(|| {
        let mut entries = Vec::new();

        for entry in fs::read_dir(path)? {
            entries.push(entry?.path());
        }

        Ok(entries)
    })
    .await?
}

async fn unpack_dir(root: PathBuf) -> Result<(), Error> {
    let entries = get_dir_entries(root.clone()).await?;

    let root = Arc::new(root);

    for path_chunk in entries.chunks(MAX_FS_CONCURRENCY) {
        let mut join_set = JoinSet::new();

        for path in path_chunk {
            let path = path.clone();
            let extension = path
                .extension()
                .map(OsStr::to_ascii_lowercase)
                .unwrap_or_default();
            let extension = extension.to_string_lossy();

            if extension == "zip" {
                let root = root.clone();

                join_set.spawn_blocking(move || -> Result<(), Error> {
                    if path.metadata()?.is_file() {
                        let file = File::open(&path)?;
                        let mut archive = ZipArchive::new(file)?;

                        archive.extract(&*root)?;
                        fs::remove_file(&path)?;
                    }

                    Ok(())
                });
            }
        }

        while let Some(result) = join_set.join_next().await {
            result??;
        }
    }

    Ok(())
}

async fn handle_dir_entry(path: PathBuf) -> Result<Option<IndexedDirEntry>, Error> {
    task::spawn_blocking(move || {
        let filename = path.file_name().unwrap_or_default().to_string_lossy();
        let filestem = path.file_stem().unwrap_or_default().to_string_lossy();

        let uuid = Uuid::try_parse(&filestem).unwrap_or_else(|_| Uuid::new_v4());
        let mut buffer = Uuid::encode_buffer();
        let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

        #[allow(clippy::single_match_else)]
        match path.extension() {
            Some(extension) => {
                if extension.to_ascii_lowercase() == "toml" {
                    let metadata = path.metadata()?;

                    if !metadata.is_file() {
                        return Ok(None);
                    }

                    if *formatted != *filestem || extension != "toml" {
                        let mut new_path = path.with_file_name(formatted);
                        new_path.set_extension("toml");
                        fs::rename(path, new_path)?;
                    }

                    Ok(Some(IndexedDirEntry::File(uuid)))
                } else {
                    Ok(None)
                }
            }
            None => {
                let metadata = path.metadata()?;

                if !metadata.is_dir() {
                    return Ok(None);
                }

                if *formatted != *filename {
                    let new_path = path.with_file_name(formatted);
                    fs::rename(path, new_path)?;
                }

                Ok(Some(IndexedDirEntry::Folder(uuid)))
            }
        }
    })
    .await?
}

enum IndexedDirEntry {
    File(Uuid),
    Folder(Uuid),
}

struct DirScanResults {
    files: HashSet<Uuid>,
    folders: HashSet<Uuid>,
}

async fn scan_dir(root: PathBuf) -> Result<DirScanResults, Error> {
    let entries = get_dir_entries(root).await?;

    let mut results = DirScanResults {
        files: HashSet::new(),
        folders: HashSet::new(),
    };

    for path_chunk in entries.chunks(MAX_FS_CONCURRENCY) {
        let mut join_set = JoinSet::new();

        for path in path_chunk {
            join_set.spawn(handle_dir_entry(path.clone()));
        }

        while let Some(result) = join_set.join_next().await {
            match result?? {
                Some(IndexedDirEntry::File(file)) => {
                    if results.files.contains(&file) {
                        return Err(Error::Io(io::Error::from(ErrorKind::AlreadyExists)));
                    }

                    results.files.insert(file);
                }
                Some(IndexedDirEntry::Folder(folder)) => {
                    if results.folders.contains(&folder) {
                        return Err(Error::Io(io::Error::from(ErrorKind::AlreadyExists)));
                    }

                    results.folders.insert(folder);
                }
                None => {}
            }
        }
    }

    Ok(results)
}

pub struct DataStore {
    pub root: PathBuf,
}

impl DataStore {
    pub async fn get_course(&self, id: Uuid) -> Result<Course, Error> {
        let root = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));

        task::spawn_blocking(move || {
            let index_path = root.join("course.toml");

            let data = fs::read_to_string(index_path)?;
            let deserializer = Deserializer::new(&data);

            let mut index = Course::deserialize(deserializer)?;
            index.uuid = id;
            index.make_paths_relative();

            for book in &mut index.books {
                book.file = root.join(&book.file);
            }

            Ok(index)
        })
        .await?
    }

    pub async fn get_course_map(&self, id: Uuid) -> Result<(CourseMap, String), Error> {
        let mut path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));
        path.set_extension("toml");

        task::spawn_blocking(move || {
            let data = fs::read_to_string(path)?;
            let deserializer = Deserializer::new(&data);

            let mut data = CourseMap::deserialize(deserializer)?;
            data.uuid = id;

            let rendered = data.generate_svg();

            Ok((data, rendered))
        })
        .await?
    }

    pub async fn scan(&self) -> Result<ScanResult, Error> {
        unpack_dir(self.root.clone()).await?;

        let scan = scan_dir(self.root.clone()).await?;

        Ok(ScanResult {
            courses: scan.files.into_iter().collect(),
            course_maps: scan.folders.into_iter().collect(),
        })
    }
}

pub struct ScanResult {
    pub courses: Vec<Uuid>,
    pub course_maps: Vec<Uuid>,
}
