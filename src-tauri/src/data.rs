use std::{
    cmp,
    collections::HashMap,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
    sync::{Arc, Weak},
};

use derive_more::{Display, Error, From};

use serde::{de::DeserializeOwned, Serialize};
use tokio::{
    fs::{self, File, OpenOptions},
    io::{self, AsyncReadExt, AsyncWriteExt},
    sync::{Mutex, RwLock},
};
use toml::{Deserializer, Serializer};
use uuid::Uuid;

pub fn get_data_dir(app_handle: tauri::AppHandle) -> Option<PathBuf> {
    app_handle.path_resolver().app_data_dir()
}

async fn ensure_folder_exists(path: &Path) -> Result<(), io::Error> {
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

/*pub async fn deserialize_config_folder<T>(path: &Path) -> Result<Vec<T>, DataError>
where
    T: DeserializeOwned,
{
    ensure_folder_exists(path).await?;

    let mut items = Vec::new();

    let mut entries = fs::read_dir(path).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();

        if path.ends_with(".toml") {
            let data = fs::read_to_string(&path).await?;
            items.push(toml::from_str(&data)?);
        }
    }

    Ok(items)
}*/

/*
Plans:
- Course maps: No sorting required
- Courses: Organized by UUID

*/

#[derive(From, Debug, Display, Error)]
pub enum DataError {
    Io(io::Error),
    TomlDe(toml::de::Error),
    TomlSe(toml::ser::Error),
}

pub struct ActiveConfigFile {
    pub file: File,
    buffer: String,
}

impl ActiveConfigFile {
    pub async fn new(path: &Path) -> Result<Self, DataError> {
        let file = OpenOptions::new().read(true).write(true).open(path).await?;

        Ok(Self {
            file,
            buffer: String::new(),
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

pub struct DataManager {
    pub root: PathBuf,
    pub files: Arc<RwLock<HashMap<OsString, Weak<Mutex<ActiveConfigFile>>>>>,
}

impl DataManager {
    pub async fn new(root: PathBuf) -> Result<Self, DataError> {
        todo!()
    }
    pub async fn get<T>(name: &OsStr) -> Result<T, DataError>
    where
        T: DeserializeOwned,
    {
        todo!()
    }
    pub async fn get_all<T>() -> Result<Vec<T>, DataError>
    where
        T: DeserializeOwned,
    {
        todo!()
    }
    pub async fn set<T>(name: &OsStr, data: &T) -> Result<(), DataError>
    where
        T: Serialize,
    {
        todo!()
    }
}

pub struct ResourceManager {
    pub root: PathBuf,
}

impl ResourceManager {
    pub async fn new(root: PathBuf) -> Result<Self, DataError> {
        ensure_folder_exists(&root).await?;

        Ok(Self { root })
    }
    pub async fn get(&self, id: Uuid) -> Option<PathBuf> {
        let path = self.root.join(format!("{}", id));

        match fs::metadata(&path).await {
            Ok(metadata) => match metadata.is_dir() {
                true => Some(path),
                false => None,
            },
            Err(_) => None,
        }
    }
    pub async fn scan(&self) -> Result<Vec<Uuid>, DataError> {
        let mut items = Vec::new();

        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();

            let is_dir = match fs::metadata(&path).await {
                Ok(metadata) => metadata.is_dir(),
                Err(_) => false,
            };

            if is_dir {
                let uuid = Uuid::try_parse(&path.file_name().unwrap_or_default().to_string_lossy());

                match uuid {
                    Ok(uuid) => items.push(uuid),
                    Err(_) => {
                        let uuid = Uuid::new_v4();
                        let dest = path.with_file_name(format!("{}", uuid));

                        fs::rename(path, dest).await?;

                        items.push(uuid)
                    }
                }
            }
        }

        Ok(items)
    }
}

#[tauri::command]
pub async fn open_data_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = get_data_dir(app_handle).ok_or("Unable to find application data directory")?;

    ensure_folder_exists(&path)
        .await
        .map_err(|err| format!("Unable to open application data directory: {}", err))?;

    open::that_detached(&path)
        .map_err(|err| format!("Unable to launch system file opener: {}", err))
}
