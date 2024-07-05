use std::{
    env,
    ffi::OsString,
    io::ErrorKind,
    path::{Component, Path, PathBuf},
};

use advisory_lock::{AdvisoryFileLock, FileLockError, FileLockMode};
use serde::{de::DeserializeOwned, Serialize};
use thiserror::Error;
use tokio::{
    fs::{self, File, OpenOptions},
    io::{self, AsyncReadExt, AsyncWriteExt},
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
            Component::Prefix(_) => {}
            Component::RootDir => {}
            Component::CurDir => {}
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

pub async fn get_data_dir(dirname: &str) -> Result<PathBuf, DataError> {
    let mut path = match dirs_next::data_dir() {
        Some(path) => path,
        None => env::current_dir()?,
    };
    path.push("item");
    path.set_file_name(dirname);

    ensure_folder_exists(&path).await?;

    Ok(path)
}

pub async fn ensure_folder_exists(path: &Path) -> Result<(), DataError> {
    let metadata = fs::metadata(path).await;

    match metadata {
        Ok(metadata) => {
            if !metadata.is_dir() {
                fs::remove_file(path).await?;
                fs::create_dir_all(path).await?;
            }
        }
        Err(_) => {
            fs::create_dir_all(path).await?;
        }
    };

    Ok(())
}

#[derive(Error, Debug)]
pub enum DataError {
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

impl From<FileLockError> for DataError {
    fn from(value: FileLockError) -> Self {
        match value {
            FileLockError::AlreadyLocked => Self::AlreadyLocked,
            FileLockError::Io(err) => Self::Io(err),
        }
    }
}

async fn lock_file(file: File, mode: FileLockMode) -> Result<File, DataError> {
    let std_file = file.into_std().await;

    let file = task::spawn_blocking(move || -> Result<File, FileLockError> {
        std_file.lock(mode)?;

        Ok(File::from_std(std_file))
    })
    .await??;

    Ok(file)
}

/// A read-only handle to a TOML configuration file.
pub struct ConfigFile {
    pub file: File,
    buffer: String,
}

impl ConfigFile {
    pub async fn new(path: &Path) -> Result<Self, DataError> {
        let file = File::open(path).await?;
        let file = lock_file(file, FileLockMode::Shared).await?;
        let metadata = file.metadata().await?;

        Ok(Self {
            file,
            buffer: String::with_capacity(metadata.len().try_into().unwrap_or_default()),
        })
    }
    pub async fn read<T>(&mut self) -> Result<T, DataError>
    where
        T: DeserializeOwned,
    {
        self.buffer.clear();
        self.file.read_to_string(&mut self.buffer).await?;

        let deserializer = Deserializer::new(&self.buffer);
        Ok(T::deserialize(deserializer)?)
    }
}

/// A read-write handle to a TOML configuration file.
pub struct WritableConfigFile {
    pub file: File,
    buffer: String,
}

impl WritableConfigFile {
    pub async fn new(path: &Path) -> Result<Self, DataError> {
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)
            .await?;
        let file = lock_file(file, FileLockMode::Exclusive).await?;
        let metadata = file.metadata().await?;

        Ok(Self {
            file,
            buffer: String::with_capacity(metadata.len().try_into().unwrap_or_default()),
        })
    }
    pub async fn read<T>(&mut self) -> Result<T, DataError>
    where
        T: DeserializeOwned,
    {
        self.buffer.clear();
        self.file.read_to_string(&mut self.buffer).await?;

        let deserializer = Deserializer::new(&self.buffer);
        Ok(T::deserialize(deserializer)?)
    }
    pub async fn write<T>(&mut self, data: &T) -> Result<(), DataError>
    where
        T: Serialize,
    {
        self.buffer.clear();

        let serializer = Serializer::new(&mut self.buffer);
        data.serialize(serializer)?;

        self.file.write_all(self.buffer.as_bytes()).await?;
        self.file.set_len(self.buffer.len() as u64).await?;

        Ok(())
    }
}

/// DataManager is a UUID-indexed file manager.
pub struct DataManager {
    pub root: PathBuf,
    pub extension: Option<OsString>,
}

impl DataManager {
    pub async fn new(root: PathBuf, mut extension: Option<OsString>) -> Result<Self, DataError> {
        ensure_folder_exists(&root).await?;

        if let Some(extension) = &mut extension {
            extension.make_ascii_lowercase();
        }

        Ok(Self { root, extension })
    }
    pub async fn get(&self, id: Uuid) -> Result<PathBuf, DataError> {
        let mut path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));
        if let Some(extension) = &self.extension {
            path.set_extension(extension);
        }

        match fs::metadata(&path).await {
            Ok(metadata) => match metadata.is_dir() {
                true => Ok(path),
                //false => Err(DataError::Io(io::Error::from(ErrorKind::IsADirectory))),
                false => Err(DataError::Io(io::Error::from(ErrorKind::NotFound))),
            },
            Err(err) => Err(DataError::Io(err)),
        }
    }
    pub async fn scan(&self) -> Result<Vec<Uuid>, DataError> {
        let mut items = Vec::new();
        let mut buffer = Uuid::encode_buffer();

        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            let is_file = match fs::metadata(&path).await {
                Ok(metadata) => metadata.is_file(),
                Err(_) => false,
            };

            let extension = path.extension();

            if !is_file || extension.map(|e| e.to_ascii_lowercase()) != self.extension {
                continue;
            }

            let filestem = path.file_stem().unwrap_or_default().to_string_lossy();

            let uuid = Uuid::try_parse(&filestem).unwrap_or_else(|_| Uuid::new_v4());
            let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

            if *formatted != *filestem || extension != self.extension.as_deref() {
                let mut new_path = path.with_file_name(formatted);
                if let Some(extension) = &self.extension {
                    new_path.set_extension(extension);
                }
                fs::rename(&path, new_path).await?;
            }

            items.push(uuid);
        }

        Ok(items)
    }
}

/// ResourceManager is a UUID-indexed folder manager.
pub struct ResourceManager {
    pub root: PathBuf,
}

impl ResourceManager {
    pub async fn new(root: PathBuf) -> Result<Self, DataError> {
        ensure_folder_exists(&root).await?;

        Ok(Self { root })
    }
    pub async fn get(&self, id: Uuid) -> Result<PathBuf, DataError> {
        let path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));

        match fs::metadata(&path).await {
            Ok(metadata) => match metadata.is_dir() {
                true => Ok(path),
                //false => Err(DataError::Io(io::Error::from(ErrorKind::NotADirectory))),
                false => Err(DataError::Io(io::Error::from(ErrorKind::NotFound))),
            },
            Err(err) => Err(DataError::Io(err)),
        }
    }
    pub async fn scan(&self) -> Result<Vec<Uuid>, DataError> {
        let mut items = Vec::new();
        let mut buffer = Uuid::encode_buffer();

        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            let is_dir = match fs::metadata(&path).await {
                Ok(metadata) => metadata.is_dir(),
                Err(_) => false,
            };

            if !is_dir {
                continue;
            }

            let filename = path.file_name().unwrap_or_default().to_string_lossy();

            let uuid = Uuid::try_parse(&filename).unwrap_or_else(|_| Uuid::new_v4());
            let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

            if *formatted != *filename {
                fs::rename(&path, path.with_file_name(formatted)).await?;
            }

            items.push(uuid);
        }

        Ok(items)
    }
}
