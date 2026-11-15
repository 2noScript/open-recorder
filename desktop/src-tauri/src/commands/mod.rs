use std::path::{Path, PathBuf};

use chrono::Utc;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::capture::{
    list_audio_devices as enumerate_audio, list_displays as enumerate_displays, CaptureManager,
    MicMonitor,
};
use crate::db::Database;
use crate::error::{AppError, AppResult};
use crate::input_hooks::InputTracker;
use crate::models::{
    AudioDeviceInfo, DisplayInfo, GifExportRequest, NewRecording, PermissionStatus, Recording,
    RecordingConfig, SystemInfo, TrimRequest, WindowInfo,
};
use crate::processor;

pub struct AppState {
    pub db: Database,
    pub capture: CaptureManager,
    pub mic_monitor: MicMonitor,
    pub input_tracker: InputTracker,
    pub recordings_dir: PathBuf,
    pub db_path: PathBuf,
}

#[tauri::command]
pub fn get_all_recordings(state: State<'_, AppState>) -> AppResult<Vec<Recording>> {
    state.db.get_all_recordings()
}

#[tauri::command]
pub fn save_recording(
    recording: NewRecording,
    state: State<'_, AppState>,
) -> AppResult<Recording> {
    if recording.name.trim().is_empty() {
        return Err(AppError::InvalidInput("Recording name cannot be empty".into()));
    }
    state.db.save_recording(&recording)
}

#[tauri::command]
pub fn update_recording_name(
    id: i64,
    name: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("Recording name cannot be empty".into()));
    }
    state.db.update_recording_name(id, trimmed)
}

#[tauri::command]
pub fn delete_recording(id: i64, state: State<'_, AppState>) -> AppResult<()> {
    let deleted = state.db.delete_recording(id)?;
    let video_path = Path::new(&deleted.file_path);
    if video_path.exists() {
        let _ = std::fs::remove_file(video_path);
    }
    if let Some(thumb) = &deleted.thumbnail_path {
        let thumb_path = Path::new(thumb);
        if thumb_path.exists() {
            let _ = std::fs::remove_file(thumb_path);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn export_recording_file(
    source_path: String,
    dest_path: String,
) -> AppResult<()> {
    let src = Path::new(&source_path);
    if !src.is_file() {
        return Err(AppError::NotFound(format!(
            "Source recording file not found: {source_path}"
        )));
    }
    let dst = Path::new(&dest_path);
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(src, dst)?;
    Ok(())
}

#[tauri::command]
pub fn open_recording_in_folder(file_path: String) -> AppResult<()> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "Recording file not found: {file_path}"
        )));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &file_path])
            .spawn()?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open").arg(parent).spawn()?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_displays() -> AppResult<Vec<DisplayInfo>> {
    enumerate_displays()
}

#[tauri::command]
pub fn list_audio_devices() -> AppResult<Vec<AudioDeviceInfo>> {
    enumerate_audio()
}

#[tauri::command]
pub fn start_mic_monitor(
    device_name: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<()> {
    state.mic_monitor.start(device_name, app)
}

#[tauri::command]
pub fn stop_mic_monitor(state: State<'_, AppState>) {
    state.mic_monitor.stop();
}

#[tauri::command]
pub fn start_recording(
    config: RecordingConfig,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let filename = format!(
        "recording-{}-{}.mp4",
        Utc::now().format("%Y%m%d-%H%M%S"),
        &Uuid::new_v4().to_string()[..8]
    );
    let output_path = state.recordings_dir.join(&filename);
    state.capture.start(&config, output_path.clone(), app)?;
    Ok(output_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn pause_recording(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    state.capture.pause()?;
    let _ = app.emit("recording-state-changed", "paused");
    Ok(())
}

#[tauri::command]
pub fn resume_recording(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    state.capture.resume()?;
    let _ = app.emit("recording-state-changed", "recording");
    Ok(())
}

#[tauri::command]
pub fn stop_recording(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Recording> {
    let (file_path, elapsed_ms) = state.capture.stop()?;
    let size = std::fs::metadata(&file_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    let probed_ms = processor::probe_duration_ms(&file_path).unwrap_or(0);
    let duration = if probed_ms > 0 { probed_ms } else { elapsed_ms };

    let thumb_path = file_path.with_extension("jpg");
    let thumbnail_path = match processor::generate_thumbnail(&file_path, &thumb_path) {
        Ok(()) => Some(thumb_path.to_string_lossy().into_owned()),
        Err(_) => None,
    };

    let now = Utc::now();
    let name = format!("Recording {}", now.format("%Y-%m-%d %H:%M:%S"));
    let saved = state.db.save_recording(&NewRecording {
        name,
        file_path: file_path.to_string_lossy().into_owned(),
        thumbnail_path,
        mime_type: "video/mp4".into(),
        duration,
        size,
        created_at: now.to_rfc3339(),
    })?;
    let _ = app.emit("recording-stopped", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn get_recordings_dir(state: State<'_, AppState>) -> String {
    state.recordings_dir.to_string_lossy().into_owned()
}

#[tauri::command]
pub fn open_recordings_dir(state: State<'_, AppState>) -> AppResult<()> {
    let dir = &state.recordings_dir;
    std::fs::create_dir_all(dir)?;
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(dir).spawn()?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(dir).spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(dir).spawn()?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_recording_status(state: State<'_, AppState>) -> String {
    state.capture.status()
}

#[tauri::command]
pub fn trim_recording(
    req: TrimRequest,
    state: State<'_, AppState>,
) -> AppResult<Recording> {
    let source = state.db.get_recording_by_id(req.recording_id)?;
    let input_path = Path::new(&source.file_path);
    if !input_path.is_file() {
        return Err(AppError::NotFound("Source video file not found".into()));
    }

    let filename = format!(
        "trimmed-{}.mp4",
        &Uuid::new_v4().to_string()[..8]
    );
    let output_path = state.recordings_dir.join(filename);
    processor::trim_video(input_path, &output_path, req.start_sec, req.end_sec)?;

    let size = std::fs::metadata(&output_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    let duration = processor::probe_duration_ms(&output_path)
        .unwrap_or(((req.end_sec - req.start_sec) * 1000.0).round() as i64);

    let thumb_path = output_path.with_extension("jpg");
    let thumbnail_path = match processor::generate_thumbnail(&output_path, &thumb_path) {
        Ok(()) => Some(thumb_path.to_string_lossy().into_owned()),
        Err(_) => None,
    };

    let name = req
        .output_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("{} (Trimmed)", source.name));

    state.db.save_recording(&NewRecording {
        name,
        file_path: output_path.to_string_lossy().into_owned(),
        thumbnail_path,
        mime_type: "video/mp4".into(),
        duration,
        size,
        created_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn export_gif(req: GifExportRequest) -> AppResult<String> {
    let input = Path::new(&req.input_path);
    if !input.is_file() {
        return Err(AppError::NotFound("Input video file not found".into()));
    }
    let output = Path::new(&req.output_path);
    processor::export_gif(
        input,
        output,
        req.start_sec,
        req.end_sec,
        req.fps.max(1),
        req.width.max(64),
    )?;
    Ok(req.output_path)
}

#[tauri::command]
pub fn generate_thumbnail(video_path: String, output_path: String) -> AppResult<String> {
    processor::generate_thumbnail(Path::new(&video_path), Path::new(&output_path))?;
    Ok(output_path)
}

#[tauri::command]
pub fn set_input_tracking(
    mouse: bool,
    keyboard: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) {
    state.input_tracker.set_tracking(mouse, keyboard, &app);
}

#[tauri::command]
pub fn set_overlay_ignore_cursor(ignore: bool, app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("overlay") {
        win.set_ignore_cursor_events(ignore)?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_overlay_window(display_index: Option<u32>, app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("overlay") {
        let target_monitor = display_index
            .and_then(|idx| {
                let ordinal = crate::capture::display_ordinal_for_index(idx);
                win.available_monitors().ok()?.into_iter().nth(ordinal)
            })
            .or_else(|| win.primary_monitor().ok().flatten());

        if let Some(monitor) = target_monitor {
            let _ = win.set_position(*monitor.position());
            let _ = win.set_size(*monitor.size());
        }
        win.show()?;
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub async fn capture_display_preview(display_index: u32) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::capture::capture_display_preview(display_index)
    })
    .await
    .map_err(|e| AppError::Recording(format!("Preview task failed: {e}")))?
}

#[tauri::command]
pub async fn list_windows() -> AppResult<Vec<WindowInfo>> {
    tauri::async_runtime::spawn_blocking(crate::capture::list_windows)
        .await
        .map_err(|e| AppError::Recording(format!("Window list task failed: {e}")))?
}

#[tauri::command]
pub async fn capture_window_preview(window_id: u32) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || crate::capture::capture_window_preview(window_id))
        .await
        .map_err(|e| AppError::Recording(format!("Window preview task failed: {e}")))?
}

#[tauri::command]
pub fn hide_overlay_window(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("overlay") {
        win.hide()?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_mini_bar(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("mini-bar") {
        win.show()?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_mini_bar(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("mini-bar") {
        win.hide()?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("main") {
        win.show()?;
        win.set_focus()?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("main") {
        win.hide()?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[tauri::command]
pub fn check_permissions() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    let screen_recording =
        processor::resolve_binary("ffmpeg").is_some() && unsafe { CGPreflightScreenCaptureAccess() };
    #[cfg(not(target_os = "macos"))]
    let screen_recording = processor::resolve_binary("ffmpeg").is_some();

    PermissionStatus {
        screen_recording,
        microphone: enumerate_audio().map(|d| !d.is_empty()).unwrap_or(false),
        accessibility: true,
    }
}

#[tauri::command]
pub fn open_privacy_settings(pane: String) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        if pane == "screen" {
            unsafe {
                CGRequestScreenCaptureAccess();
            }
        }
        let url = match pane.as_str() {
            "screen" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            "mic" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
            "accessibility" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            _ => "x-apple.systempreferences:com.apple.preference.security",
        };
        std::process::Command::new("open").arg(url).spawn()?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = pane;
    Ok(())
}

#[tauri::command]
pub async fn get_system_info(state: State<'_, AppState>) -> AppResult<SystemInfo> {
    let recordings_dir = state.recordings_dir.to_string_lossy().to_string();
    let db_path = state.db_path.to_string_lossy().to_string();

    tauri::async_runtime::spawn_blocking(move || {
        let ffmpeg = processor::resolve_binary("ffmpeg");
        let ffprobe = processor::resolve_binary("ffprobe");

        let ffmpeg_version = ffmpeg.as_deref().and_then(processor::ffmpeg_version_info);
        let hardware_encoder = ffmpeg.as_deref().and_then(processor::detect_hardware_encoder);

        SystemInfo {
            ffmpeg_installed: ffmpeg.is_some(),
            ffmpeg_path: ffmpeg.map(|p| p.to_string_lossy().to_string()),
            ffmpeg_version,
            ffprobe_installed: ffprobe.is_some(),
            ffprobe_path: ffprobe.map(|p| p.to_string_lossy().to_string()),
            hardware_encoder,
            recordings_dir,
            db_path,
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
        }
    })
    .await
    .map_err(|e| AppError::Recording(format!("System info task failed: {e}")))
}
