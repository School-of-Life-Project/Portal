use std::{
    io::ErrorKind,
    path::{Path, PathBuf},
};

use derive_more::{Display, Error, From};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tokio::{
    fs::{self, DirEntry, File, ReadDir},
    io::{self, AsyncReadExt},
    task,
};
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

pub async fn deserialize_file<T>(path: &Path) -> Result<T, DataError>
where
    T: DeserializeOwned,
{
    let data = fs::read_to_string(path).await?;
    Ok(toml::from_str(&data)?)
}

pub async fn deserialize_config_folder<F, T>(
    path: &Path,
) -> Result<Vec<Result<T, toml::de::Error>>, io::Error>
where
    F: Fn(&Path) -> bool,
    T: DeserializeOwned,
{
    ensure_folder_exists(path).await?;

    let mut items = Vec::new();

    let mut entries = fs::read_dir(path).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();

        if path.ends_with(".toml") {
            let data = fs::read_to_string(&path).await?;
            items.push(toml::from_str(&data));
        }
    }

    Ok(items)
}

/*
Plans:
- Course maps: No sorting required
- Courses: Organized by UUID

*/

#[derive(From, Debug, Display, Error)]
pub enum DataError {
    ioError(io::Error),
    tomlError(toml::de::Error),
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
