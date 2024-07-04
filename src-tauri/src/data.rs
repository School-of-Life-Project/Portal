use std::path::Path;

use derive_more::{Display, Error, From};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tokio::{
    fs::{self, File, ReadDir},
    io::{self, AsyncReadExt},
    task,
};

/*#[derive(From, Debug, Display, Error)]
pub enum DataError {
    ioError(io::Error),
    tomlError(toml::de::Error),
}*/

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

pub async fn deserialize_config_folder<F, T>(
    path: &Path,
    callback: F,
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

        if callback(&path) {
            let data = fs::read_to_string(&path).await?;
            items.push(toml::from_str(&data));
        }
    }

    Ok(items)
}

#[tauri::command]
pub async fn open_data_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Unable to find application data directory")?;

    ensure_folder_exists(&path)
        .await
        .map_err(|err| format!("Unable to open application data directory: {}", err))?;

    open::that_detached(&path)
        .map_err(|err| format!("Unable to launch system file opener: {}", err))
}
