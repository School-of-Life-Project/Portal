use std::{
    collections::HashMap,
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    sync::{Arc, Weak},
};

use derive_more::{Display, Error, From};

use serde::{de::DeserializeOwned, Serialize};
use tokio::{
    fs::{self, File, OpenOptions},
    io::{self, AsyncReadExt, AsyncWriteExt},
    sync::{Mutex, OwnedMutexGuard},
};
use toml::{Deserializer, Serializer};
use uuid::{fmt::Simple, Uuid};

pub async fn get_data_dir(dirname: &str) -> Result<PathBuf, io::Error> {
    let mut path = match dirs_next::data_dir() {
        Some(path) => path,
        None => env::current_dir()?,
    };
    path.push("item");
    path.set_file_name(dirname);

    ensure_folder_exists(&path).await?;

    Ok(path)
}

pub async fn ensure_folder_exists(path: &Path) -> Result<(), io::Error> {
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

/// A custom Error type for errors returned by this module.
#[derive(From, Debug, Display, Error)]
pub enum DataError {
    Io(io::Error),
    TomlDe(toml::de::Error),
    TomlSe(toml::ser::Error),
}

/// A read-write manager of TOML configuration files.
pub struct ConfigFile {
    pub file: File,
    buffer: String,
}

impl ConfigFile {
    pub async fn new(path: &Path) -> Result<Self, DataError> {
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)
            .await?;
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

/// DataManager is a read-write manager of UUID-indexed ConfigFile objects.
///
/// Each ConfigFile maps to a TOML file within the DataManager's root folder.
pub struct DataManager {
    pub root: PathBuf,
    files: Arc<Mutex<HashMap<Uuid, Weak<Mutex<ConfigFile>>>>>,
    extension: OsString,
}

impl DataManager {
    pub async fn new(root: PathBuf) -> Result<Self, DataError> {
        ensure_folder_exists(&root).await?;

        Ok(Self {
            root,
            files: Arc::new(Mutex::new(HashMap::new())),
            extension: OsString::from("toml"),
        })
    }
    async fn new_file(&self, id: Uuid) -> Result<ConfigFile, DataError> {
        let mut path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));
        path.set_extension(OsString::from(&self.extension));

        ConfigFile::new(&path).await
    }
    pub async fn get(&self, id: Uuid) -> Result<OwnedMutexGuard<ConfigFile>, DataError> {
        let mut files = self.files.lock().await;

        let mutex = match files.get(&id).and_then(|file| file.upgrade()) {
            Some(file) => file.clone(),
            None => {
                let new = Arc::new(Mutex::new(self.new_file(id).await?));

                files.insert(id, Arc::downgrade(&new));

                new
            }
        };

        Ok(mutex.lock_owned().await)
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

            if !is_file || path.extension() != Some(&self.extension) {
                continue;
            }

            let filestem = path.file_stem().unwrap_or_default().to_string_lossy();

            let uuid = Uuid::try_parse(&filestem).unwrap_or_else(|_| Uuid::new_v4());
            let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

            if *formatted != *filestem {
                let mut new_path = path.with_file_name(formatted);
                new_path.set_extension(&self.extension);
                fs::rename(&path, new_path).await?;
            }

            items.push(uuid);
        }

        Ok(items)
    }
}

/// A read-only version of DataManager, optimized for reading large numbers of files.
pub struct BasicDataManager {
    pub root: PathBuf,
    extension: OsString,
}

impl BasicDataManager {
    pub async fn new(root: PathBuf) -> Result<Self, DataError> {
        ensure_folder_exists(&root).await?;

        Ok(Self {
            root,
            extension: OsString::from("toml"),
        })
    }
    pub async fn get<T>(&self, id: Uuid) -> Result<T, DataError>
    where
        T: DeserializeOwned,
    {
        let mut path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));
        path.set_extension(OsString::from(&self.extension));

        let mut file = File::open(path).await?;
        let metadata = file.metadata().await?;

        let mut buffer = String::with_capacity(metadata.len().try_into().unwrap_or_default());

        file.read_to_string(&mut buffer).await?;

        let deserializer = Deserializer::new(&buffer);
        Ok(T::deserialize(deserializer)?)
    }
    pub async fn scan(&self) -> Result<Vec<Uuid>, io::Error> {
        let mut items = Vec::new();
        let mut buffer = Uuid::encode_buffer();

        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            let is_file = match fs::metadata(&path).await {
                Ok(metadata) => metadata.is_file(),
                Err(_) => false,
            };

            if !is_file || path.extension() != Some(&self.extension) {
                continue;
            }

            let filestem = path.file_stem().unwrap_or_default().to_string_lossy();

            let uuid = Uuid::try_parse(&filestem).unwrap_or_else(|_| Uuid::new_v4());
            let formatted = Simple::from_uuid(uuid).encode_lower(&mut buffer);

            if *formatted != *filestem {
                let mut new_path = path.with_file_name(formatted);
                new_path.set_extension(&self.extension);
                fs::rename(&path, new_path).await?;
            }

            items.push(uuid);
        }

        Ok(items)
    }
}

/// ResourceManager is a read-only resource bundle manager.
///
/// Resource bundles are folders with a valid Uuid as their name.
pub struct ResourceManager {
    pub root: PathBuf,
}

impl ResourceManager {
    pub async fn new(root: PathBuf) -> Result<Self, io::Error> {
        ensure_folder_exists(&root).await?;

        Ok(Self { root })
    }
    pub async fn get(&self, id: Uuid) -> Option<PathBuf> {
        let path = self
            .root
            .join(Simple::from_uuid(id).encode_lower(&mut Uuid::encode_buffer()));

        match fs::metadata(&path).await {
            Ok(metadata) => match metadata.is_dir() {
                true => Some(path),
                false => None,
            },
            Err(_) => None,
        }
    }
    pub async fn scan(&self) -> Result<Vec<Uuid>, io::Error> {
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
