#![allow(clippy::module_name_repetitions)]

use std::{
    collections::HashSet,
    env,
    ffi::{OsStr, OsString},
    fs::{File, OpenOptions},
    io::{ErrorKind, Read, Seek, SeekFrom, Write},
    path::{Component, Path, PathBuf},
};

use advisory_lock::{AdvisoryFileLock, FileLockError, FileLockMode};
use serde::{de::DeserializeOwned, Serialize};
use thiserror::Error;
use tokio::{
    fs,
    io::{self},
    task::{self, JoinError},
};
use toml::{Deserializer, Serializer};
use uuid::{fmt::Simple, Uuid};

pub fn into_relative_path(root: &Path, path: &Path) -> PathBuf {
    let mut new = PathBuf::from(root);

    let mut items: usize = 0;
    let mut popped = 0;

    for component in path.components() {
        match component {
            Component::Prefix(_) | Component::RootDir | Component::CurDir => {}
            Component::ParentDir => {
                if items.saturating_sub(popped) > 0 {
                    new.pop();
                    popped += 1;
                }
            }
            Component::Normal(item) => {
                new.push(item);
                items += 1;
            }
        }
    }

    new
}

pub fn get_data_dir(dirname: &str) -> Result<PathBuf, Error> {
    let mut path = match dirs_next::data_dir() {
        Some(path) => path,
        None => env::current_dir()?,
    };
    path.push("item");
    path.set_file_name(dirname);

    Ok(path)
}

pub async fn ensure_folder_exists(path: &Path) -> Result<(), Error> {
    let metadata = fs::metadata(&path).await;

    match metadata {
        Ok(metadata) => {
            if !metadata.is_dir() {
                fs::remove_file(&path).await?;
                fs::create_dir_all(&path).await?;
            }
        }
        Err(_) => {
            fs::create_dir_all(&path).await?;
        }
    }

    Ok(())
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("File is already locked by another process")]
    AlreadyLocked,
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error(transparent)]
    Deserialization(#[from] toml::de::Error),
    #[error(transparent)]
    Serialization(#[from] toml::ser::Error),
    #[error("File locking task was terminated or panicked")]
    BlockingTaskFailed(#[from] JoinError),
}

impl Error {
    pub fn is_not_found(&self) -> bool {
        if let Self::Io(err) = self {
            err.kind() == ErrorKind::NotFound
        } else {
            false
        }
    }
}

impl From<FileLockError> for Error {
    fn from(value: FileLockError) -> Self {
        match value {
            FileLockError::AlreadyLocked => Self::AlreadyLocked,
            FileLockError::Io(err) => Self::Io(err),
        }
    }
}

/// A read-only handle to a TOML configuration file.
///
/// If the file does not yet exist, it will be created.
/// If the file is blank when being read, the Default version of the object will be returned.
pub struct ConfigFile {
    file: File,
}

impl ConfigFile {
    pub async fn new(path: PathBuf) -> Result<Self, Error> {
        let file = task::spawn_blocking(move || -> Result<_, Error> {
            let file = File::open(path)?;
            file.lock(FileLockMode::Shared)?;

            Ok(file)
        })
        .await??;

        Ok(Self { file })
    }
    pub async fn read<T>(&mut self) -> Result<T, Error>
    where
        T: DeserializeOwned + Send + 'static,
    {
        let mut file = self.file.try_clone()?;
        task::spawn_blocking(move || -> Result<_, Error> {
            let metadata = file.metadata()?;
            let mut buffer = String::with_capacity(metadata.len().try_into().unwrap_or_default());

            file.seek(SeekFrom::Start(0))?;
            file.read_to_string(&mut buffer)?;

            let deserializer = Deserializer::new(&buffer);
            Ok(T::deserialize(deserializer)?)
        })
        .await?
    }
}

/// A read-write handle to a TOML configuration file.
///
/// This is designed with the intention of the handle being long-lived.
pub struct WritableConfigFile {
    file: File,
    buffer: String,
}

impl WritableConfigFile {
    pub async fn new(path: PathBuf) -> Result<Self, Error> {
        let (file, metadata) = task::spawn_blocking(move || -> Result<_, Error> {
            let file = OpenOptions::new()
                .create(true)
                .truncate(false)
                .read(true)
                .write(true)
                .open(path)?;
            file.lock(FileLockMode::Exclusive)?;

            let metadata = file.metadata()?;

            Ok((file, metadata))
        })
        .await??;

        Ok(Self {
            file,
            buffer: String::with_capacity(metadata.len().try_into().unwrap_or_default()),
        })
    }
    #[allow(clippy::unused_async)]
    pub async fn read<T>(&mut self) -> Result<T, Error>
    where
        T: DeserializeOwned + Default,
    {
        task::block_in_place(move || -> Result<_, Error> {
            self.buffer.clear();

            self.file.seek(SeekFrom::Start(0))?;
            self.file.read_to_string(&mut self.buffer)?;

            if self.buffer.is_empty() {
                return Ok(T::default());
            }

            let deserializer = Deserializer::new(&self.buffer);
            Ok(T::deserialize(deserializer)?)
        })
    }
    #[allow(clippy::unused_async)]
    pub async fn write<T>(&mut self, data: &T) -> Result<(), Error>
    where
        T: Serialize,
    {
        task::block_in_place(move || -> Result<_, Error> {
            self.buffer.clear();

            let serializer = Serializer::pretty(&mut self.buffer);
            data.serialize(serializer)?;

            self.file.seek(SeekFrom::Start(0))?;
            self.file.write_all(self.buffer.as_bytes())?;
            self.file.set_len(self.buffer.len() as u64)?;

            Ok(())
        })
    }
}

/// ``DataManager`` is a UUID-indexed file manager.
pub struct DataManager {
    pub root: PathBuf,
    pub extension: Option<OsString>,
}

impl DataManager {
    pub async fn new(root: PathBuf, mut extension: Option<OsString>) -> Result<Self, Error> {
        ensure_folder_exists(&root).await?;

        if let Some(extension) = &mut extension {
            extension.make_ascii_lowercase();
        }

        Ok(Self { root, extension })
    }
    /// Get the path corresponding to a Uuid.
    ///
    /// The returned path may or may not exist; It is the caller's responsibily to handle this properly.
    pub fn get(&self, id: Uuid) -> PathBuf {
        let mut path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));
        if let Some(extension) = &self.extension {
            path.set_extension(extension);
        }

        path
    }
    pub async fn scan(&self) -> Result<HashSet<Uuid>, Error> {
        let mut items = HashSet::new();
        let mut buffer = Uuid::encode_buffer();

        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            let is_file = match entry.metadata().await {
                Ok(metadata) => metadata.is_file(),
                Err(_) => false,
            };

            let extension = path.extension();

            if !is_file || extension.map(OsStr::to_ascii_lowercase) != self.extension {
                continue;
            }

            let filestem = path.file_stem().unwrap_or_default().to_string_lossy();

            let uuid = Uuid::try_parse(&filestem).unwrap_or_else(|_| Uuid::new_v4());
            let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

            if items.contains(&uuid) {
                return Err(Error::Io(io::Error::from(ErrorKind::AlreadyExists)));
            }

            if *formatted != *filestem || extension != self.extension.as_deref() {
                let mut new_path = path.with_file_name(formatted);
                if let Some(extension) = &self.extension {
                    new_path.set_extension(extension);
                }
                fs::rename(&path, new_path).await?;
            }

            items.insert(uuid);
        }

        Ok(items)
    }
}

/// ``ResourceManager`` is a UUID-indexed folder manager.
pub struct ResourceManager {
    pub root: PathBuf,
}

impl ResourceManager {
    pub async fn new(root: PathBuf) -> Result<Self, Error> {
        ensure_folder_exists(&root).await?;

        Ok(Self { root })
    }
    /// Get the path corresponding to a Uuid.
    ///
    /// The returned path may or may not exist; It is the caller's responsibily to handle this properly.
    pub fn get(&self, id: Uuid) -> PathBuf {
        self.root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()))
    }
    pub async fn scan(&self) -> Result<HashSet<Uuid>, Error> {
        let mut items = HashSet::new();
        let mut buffer = Uuid::encode_buffer();

        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            let is_dir = match entry.metadata().await {
                Ok(metadata) => metadata.is_dir(),
                Err(_) => false,
            };

            if !is_dir {
                continue;
            }

            let filename = path.file_name().unwrap_or_default().to_string_lossy();

            let uuid = Uuid::try_parse(&filename).unwrap_or_else(|_| Uuid::new_v4());
            let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

            if items.contains(&uuid) {
                return Err(Error::Io(io::Error::from(ErrorKind::AlreadyExists)));
            }

            if *formatted != *filename {
                fs::rename(&path, path.with_file_name(formatted)).await?;
            }

            items.insert(uuid);
        }

        Ok(items)
    }
}
