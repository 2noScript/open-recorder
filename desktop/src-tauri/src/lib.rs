mod capture;
mod commands;
mod db;
mod error;
mod input_hooks;
mod models;
mod processor;

use std::path::PathBuf;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

use capture::{CaptureManager, MicMonitor};
use commands::AppState;
use db::Database;
use input_hooks::InputTracker;

fn resolve_recordings_dir(app: &tauri::App) -> PathBuf {
    if let Some(video_dir) = dirs::video_dir() {
        let dir = video_dir.join("OpenRecorder");
        if std::fs::create_dir_all(&dir).is_ok() {
            return dir;
        }
    }
    let fallback = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("recordings");
    let _ = std::fs::create_dir_all(&fallback);
    fallback
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let db_path = app_data.join("open_recorder.db");
            let db = Database::open(&db_path).expect("failed to initialize SQLite database");
            let recordings_dir = resolve_recordings_dir(app);

            app.manage(AppState {
                db,
                capture: CaptureManager::new(),
                mic_monitor: MicMonitor::new(),
                input_tracker: InputTracker::new(),
                recordings_dir,
            });

            // System Tray
            let show_item = MenuItem::with_id(app, "show", "Open Recorder", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_all_recordings,
            commands::save_recording,
            commands::update_recording_name,
            commands::delete_recording,
            commands::export_recording_file,
            commands::open_recording_in_folder,
            commands::list_audio_devices,
            commands::start_mic_monitor,
            commands::stop_mic_monitor,
            commands::start_recording,
            commands::pause_recording,
            commands::resume_recording,
            commands::stop_recording,
            commands::get_recording_status,
            commands::trim_recording,
            commands::export_gif,
            commands::generate_thumbnail,
            commands::set_input_tracking,
            commands::set_overlay_ignore_cursor,
            commands::show_overlay_window,
            commands::hide_overlay_window,
            commands::check_permissions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Recorder desktop application");
}
