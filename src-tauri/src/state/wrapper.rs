use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::sync::OnceCell;

use super::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct ErrorWrapper {
    pub(super) message: String,
    pub(super) cause: serde_error::Error,
}

impl ErrorWrapper {
    pub(super) fn new<T>(message: String, inner: &T) -> Self
    where
        T: ?Sized + std::error::Error,
    {
        Self {
            message,
            cause: serde_error::Error::new(inner),
        }
    }
}

pub struct StateWrapper {
    inner: Arc<OnceCell<State>>,
}

impl StateWrapper {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(OnceCell::new()),
        }
    }
    pub(super) async fn state(&self) -> Result<&State, ErrorWrapper> {
        self.inner.get_or_try_init(State::new).await.map_err(|e| {
            ErrorWrapper::new("Unable to open application directories".to_string(), &e)
        })
    }
}
