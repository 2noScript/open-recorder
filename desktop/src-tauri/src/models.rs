use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recording {
    pub id: i64,
    pub name: String,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub mime_type: String,
    pub duration: i64,
    pub size: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRecording {
    pub name: String,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub mime_type: String,
    pub duration: i64,
    pub size: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Region {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingConfig {
    pub resolution: String,
    pub fps: u32,
    pub mic_enabled: bool,
    pub mic_device_id: String,
    pub system_audio: bool,
    pub mode: String,
    pub region: Option<Region>,
    pub display_index: Option<u32>,
    pub watermark_text: Option<String>,
    pub watermark_opacity: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub index: u32,
    pub name: String,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub id: u32,
    pub app_name: String,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub display_index: Option<u32>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingProgressPayload {
    pub elapsed: u64,
    pub file_size: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorEventPayload {
    pub x: f64,
    pub y: f64,
    pub event_type: String,
    pub button: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeystrokeEventPayload {
    pub key: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrimRequest {
    pub recording_id: i64,
    pub start_sec: f64,
    pub end_sec: f64,
    pub output_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GifExportRequest {
    pub input_path: String,
    pub output_path: String,
    pub start_sec: Option<f64>,
    pub end_sec: Option<f64>,
    pub fps: u32,
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub screen_recording: bool,
    pub microphone: bool,
    pub accessibility: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub ffmpeg_installed: bool,
    pub ffmpeg_path: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub ffprobe_installed: bool,
    pub ffprobe_path: Option<String>,
    pub hardware_encoder: Option<String>,
    pub recordings_dir: String,
    pub db_path: String,
    pub os: String,
    pub arch: String,
}
