use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] diesel::result::Error),

    #[error("Database connection error: {0}")]
    Connection(#[from] diesel::ConnectionError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Recording error: {0}")]
    Recording(String),

    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("Audio error: {0}")]
    Audio(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
