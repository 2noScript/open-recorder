use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::models::{
    AudioDeviceInfo, DisplayInfo, RecordingConfig, RecordingProgressPayload, WindowInfo,
};
use crate::processor::require_ffmpeg;

pub fn list_displays() -> AppResult<Vec<DisplayInfo>> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(ffmpeg) = require_ffmpeg() {
            if let Ok(output) = Command::new(ffmpeg)
                .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
                .output()
            {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let mut displays = Vec::new();
                for line in stderr.lines() {
                    if line.contains("Capture screen") {
                        if let Some(idx_str) = extract_avfoundation_index(line) {
                            if let Ok(index) = idx_str.parse::<u32>() {
                                let name = line
                                    .split(']')
                                    .next_back()
                                    .map(|s| s.trim().to_string())
                                    .filter(|s| !s.is_empty())
                                    .unwrap_or_else(|| format!("Display {index}"));
                                displays.push(DisplayInfo {
                                    index,
                                    name,
                                    is_primary: displays.is_empty(),
                                });
                            }
                        }
                    }
                }
                if !displays.is_empty() {
                    return Ok(displays);
                }
            }
        }
    }

    Ok(vec![DisplayInfo {
        index: 0,
        name: "Primary Display".into(),
        is_primary: true,
    }])
}

pub fn list_audio_devices() -> AppResult<Vec<AudioDeviceInfo>> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    let devices = host
        .input_devices()
        .map_err(|e| AppError::Audio(format!("Failed to enumerate audio devices: {e}")))?;

    let mut result = Vec::new();
    for (idx, device) in devices.enumerate() {
        let name = device.name().unwrap_or_else(|_| format!("Microphone {idx}"));
        let is_default = !default_name.is_empty() && name == default_name;
        result.push(AudioDeviceInfo {
            id: name.clone(),
            name,
            is_default,
        });
    }
    Ok(result)
}

pub struct MicMonitor {
    running: Arc<AtomicBool>,
    handle: Mutex<Option<std::thread::JoinHandle<()>>>,
}

impl MicMonitor {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            handle: Mutex::new(None),
        }
    }

    pub fn start(&self, device_name: Option<String>, app: AppHandle) -> AppResult<()> {
        self.stop();

        let running = Arc::clone(&self.running);
        running.store(true, Ordering::SeqCst);

        let join = std::thread::spawn(move || {
            let host = cpal::default_host();
            let device = device_name
                .as_deref()
                .and_then(|target| {
                    host.input_devices()
                        .ok()?
                        .find(|d| d.name().ok().as_deref() == Some(target))
                })
                .or_else(|| host.default_input_device());

            let Some(device) = device else {
                return;
            };
            let Ok(config) = device.default_input_config() else {
                return;
            };

            let level = Arc::new(Mutex::new(0.0_f32));
            let level_cb = Arc::clone(&level);

            let stream = match config.sample_format() {
                cpal::SampleFormat::F32 => device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _| {
                        let rms = compute_rms_f32(data);
                        if let Ok(mut guard) = level_cb.lock() {
                            *guard = rms;
                        }
                    },
                    |err| eprintln!("[mic_monitor] stream error: {err}"),
                    None,
                ),
                cpal::SampleFormat::I16 => device.build_input_stream(
                    &config.into(),
                    move |data: &[i16], _| {
                        let rms = compute_rms_i16(data);
                        if let Ok(mut guard) = level_cb.lock() {
                            *guard = rms;
                        }
                    },
                    |err| eprintln!("[mic_monitor] stream error: {err}"),
                    None,
                ),
                _ => return,
            };

            let Ok(stream) = stream else {
                return;
            };
            if stream.play().is_err() {
                return;
            }

            while running.load(Ordering::Relaxed) {
                let current = level.lock().map(|g| *g).unwrap_or(0.0);
                let _ = app.emit("audio-level", current);
                std::thread::sleep(Duration::from_millis(50));
            }
        });

        if let Ok(mut guard) = self.handle.lock() {
            *guard = Some(join);
        }
        Ok(())
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Ok(mut guard) = self.handle.lock() {
            if let Some(handle) = guard.take() {
                let _ = handle.join();
            }
        }
    }
}

fn compute_rms_f32(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt().min(1.0)
}

fn compute_rms_i16(samples: &[i16]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples
        .iter()
        .map(|&s| {
            let f = s as f32 / i16::MAX as f32;
            f * f
        })
        .sum();
    (sum_sq / samples.len() as f32).sqrt().min(1.0)
}

struct ActiveCapture {
    child: Child,
    output_path: PathBuf,
    started_at: Instant,
    paused_total: Duration,
    paused_since: Option<Instant>,
    stop_progress: Arc<AtomicBool>,
}

pub struct CaptureManager {
    active: Mutex<Option<ActiveCapture>>,
}

impl CaptureManager {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(None),
        }
    }

    pub fn status(&self) -> String {
        let Ok(guard) = self.active.lock() else {
            return "idle".into();
        };
        match guard.as_ref() {
            None => "idle".into(),
            Some(cap) if cap.paused_since.is_some() => "paused".into(),
            Some(_) => "recording".into(),
        }
    }

    pub fn start(
        &self,
        config: &RecordingConfig,
        output_path: PathBuf,
        app: AppHandle,
    ) -> AppResult<()> {
        let mut guard = self
            .active
            .lock()
            .map_err(|e| AppError::Recording(format!("Failed to lock capture state: {e}")))?;

        if guard.is_some() {
            return Err(AppError::Recording("Recording is already in progress".into()));
        }

        let ffmpeg = require_ffmpeg()?;
        if let Some(parent) = output_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let args = build_ffmpeg_capture_args(config, &output_path, &ffmpeg)?;
        let child = Command::new(&ffmpeg)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::Recording(format!("Failed to launch FFmpeg: {e}")))?;

        let stop_progress = Arc::new(AtomicBool::new(false));
        let stop_flag = Arc::clone(&stop_progress);
        let progress_path = output_path.clone();
        let started_at = Instant::now();

        std::thread::spawn(move || {
            while !stop_flag.load(Ordering::Relaxed) {
                let file_size = std::fs::metadata(&progress_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let elapsed = started_at.elapsed().as_millis() as u64;
                let _ = app.emit(
                    "recording-progress",
                    RecordingProgressPayload {
                        elapsed,
                        file_size,
                        status: "recording".into(),
                    },
                );
                std::thread::sleep(Duration::from_millis(200));
            }
        });

        *guard = Some(ActiveCapture {
            child,
            output_path,
            started_at,
            paused_total: Duration::ZERO,
            paused_since: None,
            stop_progress,
        });

        Ok(())
    }

    pub fn pause(&self) -> AppResult<()> {
        let mut guard = self
            .active
            .lock()
            .map_err(|e| AppError::Recording(format!("Failed to lock capture state: {e}")))?;
        let cap = guard
            .as_mut()
            .ok_or_else(|| AppError::Recording("No active recording".into()))?;
        if cap.paused_since.is_none() {
            cap.paused_since = Some(Instant::now());
            #[cfg(unix)]
            {
                let pid = cap.child.id().to_string();
                let _ = Command::new("kill").args(["-STOP", &pid]).status();
            }
        }
        Ok(())
    }

    pub fn resume(&self) -> AppResult<()> {
        let mut guard = self
            .active
            .lock()
            .map_err(|e| AppError::Recording(format!("Failed to lock capture state: {e}")))?;
        let cap = guard
            .as_mut()
            .ok_or_else(|| AppError::Recording("No active recording".into()))?;
        if let Some(since) = cap.paused_since.take() {
            cap.paused_total += since.elapsed();
            #[cfg(unix)]
            {
                let pid = cap.child.id().to_string();
                let _ = Command::new("kill").args(["-CONT", &pid]).status();
            }
        }
        Ok(())
    }

    pub fn stop(&self) -> AppResult<(PathBuf, i64)> {
        let mut guard = self
            .active
            .lock()
            .map_err(|e| AppError::Recording(format!("Failed to lock capture state: {e}")))?;
        let mut cap = guard
            .take()
            .ok_or_else(|| AppError::Recording("No active recording".into()))?;

        cap.stop_progress.store(true, Ordering::SeqCst);

        if cap.paused_since.take().is_some() {
            #[cfg(unix)]
            {
                let pid = cap.child.id().to_string();
                let _ = Command::new("kill").args(["-CONT", &pid]).status();
            }
        }

        if let Some(mut stdin) = cap.child.stdin.take() {
            let _ = stdin.write_all(b"q\n");
            let _ = stdin.flush();
        }

        let status = cap
            .child
            .wait()
            .map_err(|e| AppError::Recording(format!("Failed waiting for FFmpeg: {e}")))?;

        if !status.success() && !cap.output_path.exists() {
            return Err(AppError::Recording(
                "FFmpeg exited without producing an output file".into(),
            ));
        }

        let elapsed_ms = cap
            .started_at
            .elapsed()
            .saturating_sub(cap.paused_total)
            .as_millis() as i64;

        Ok((cap.output_path, elapsed_ms))
    }
}

fn build_ffmpeg_capture_args(
    config: &RecordingConfig,
    output_path: &Path,
    ffmpeg: &Path,
) -> AppResult<Vec<String>> {
    let fps = config.fps.max(1).to_string();
    let mut args = vec!["-y".to_string()];

    #[cfg(target_os = "macos")]
    {
        let screen_idx = config
            .display_index
            .map(|i| i.to_string())
            .unwrap_or_else(|| detect_macos_screen_index(ffmpeg).unwrap_or_else(|| "1".into()));

        let input_spec = if config.mic_enabled {
            let audio_idx = detect_macos_audio_index(ffmpeg, &config.mic_device_id)
                .unwrap_or_else(|| "0".into());
            format!("{screen_idx}:{audio_idx}")
        } else {
            format!("{screen_idx}:none")
        };

        args.extend([
            "-f".into(),
            "avfoundation".into(),
            "-framerate".into(),
            fps,
            "-capture_cursor".into(),
            "1".into(),
            "-i".into(),
            input_spec,
        ]);
    }

    #[cfg(target_os = "windows")]
    {
        args.extend([
            "-f".into(),
            "gdigrab".into(),
            "-framerate".into(),
            fps,
            "-i".into(),
            "desktop".into(),
        ]);
    }

    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0.0".into());
        args.extend([
            "-f".into(),
            "x11grab".into(),
            "-framerate".into(),
            fps,
            "-i".into(),
            display,
        ]);
    }

    let mut filters: Vec<String> = Vec::new();
    if config.mode == "region" || config.mode == "window" {
        if let Some(region) = &config.region {
            if region.width > 0 && region.height > 0 {
                filters.push(format!(
                    "crop=min({}\\,iw-{}):min({}\\,ih-{}):min({}\\,iw-2):min({}\\,ih-2)",
                    region.width, region.x, region.height, region.y, region.x, region.y
                ));
            }
        }
    }

    match config.resolution.as_str() {
        "720p" => filters.push("scale=-2:720".into()),
        "1080p" => filters.push("scale=-2:1080".into()),
        "4K" => filters.push("scale=-2:2160".into()),
        _ => filters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2".into()),
    }

    if let Some(text) = &config.watermark_text {
        let trimmed = text.trim();
        if !trimmed.is_empty() && has_filter(ffmpeg, "drawtext") {
            let escaped = trimmed
                .replace('\\', "\\\\")
                .replace(':', "\\:")
                .replace('\'', "\\'");
            let opacity = config.watermark_opacity.unwrap_or(0.3).clamp(0.05, 1.0);
            filters.push(format!(
                "drawtext=text='{escaped}':fontcolor=white@{opacity:.2}:fontsize=22:x=w-tw-24:y=h-th-24"
            ));
        }
    }

    if !filters.is_empty() {
        args.push("-vf".into());
        args.push(filters.join(","));
    }

    #[cfg(target_os = "macos")]
    {
        if has_encoder(ffmpeg, "h264_videotoolbox") {
            args.extend([
                "-c:v".into(),
                "h264_videotoolbox".into(),
                "-b:v".into(),
                "8M".into(),
                "-pix_fmt".into(),
                "yuv420p".into(),
            ]);
        } else {
            args.extend([
                "-c:v".into(),
                "libx264".into(),
                "-preset".into(),
                "ultrafast".into(),
                "-pix_fmt".into(),
                "yuv420p".into(),
            ]);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        args.extend([
            "-c:v".into(),
            "libx264".into(),
            "-preset".into(),
            "ultrafast".into(),
            "-pix_fmt".into(),
            "yuv420p".into(),
        ]);
    }

    if config.mic_enabled {
        args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), "128k".into()]);
    }

    args.extend([
        "-movflags".into(),
        "+faststart".into(),
        output_path.to_string_lossy().into_owned(),
    ]);

    Ok(args)
}

#[cfg(target_os = "macos")]
fn has_encoder(ffmpeg: &Path, encoder: &str) -> bool {
    let Ok(output) = Command::new(ffmpeg).args(["-encoders"]).output() else {
        return false;
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().any(|line| line.contains(encoder))
}

fn has_filter(ffmpeg: &Path, filter: &str) -> bool {
    let Ok(output) = Command::new(ffmpeg).args(["-filters"]).output() else {
        return false;
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().any(|line| line.contains(filter))
}

#[cfg(target_os = "macos")]
fn detect_macos_screen_index(ffmpeg: &Path) -> Option<String> {
    let output = Command::new(ffmpeg)
        .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
        .output()
        .ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    for line in stderr.lines() {
        if line.contains("Capture screen") {
            if let Some(idx) = extract_avfoundation_index(line) {
                return Some(idx);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn detect_macos_audio_index(ffmpeg: &Path, preferred_name: &str) -> Option<String> {
    let output = Command::new(ffmpeg)
        .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
        .output()
        .ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut in_audio = false;
    let mut first_audio: Option<String> = None;

    for line in stderr.lines() {
        if line.contains("AVFoundation audio devices:") {
            in_audio = true;
            continue;
        }
        if in_audio {
            if let Some(idx) = extract_avfoundation_index(line) {
                if first_audio.is_none() {
                    first_audio = Some(idx.clone());
                }
                if !preferred_name.is_empty() && line.contains(preferred_name) {
                    return Some(idx);
                }
            }
        }
    }
    first_audio
}

#[cfg(target_os = "macos")]
fn extract_avfoundation_index(line: &str) -> Option<String> {
    let last_open = line.rfind('[')?;
    let rest = &line[last_open + 1..];
    let close = rest.find(']')?;
    let idx_str = rest[..close].trim();
    if idx_str.chars().all(|c| c.is_ascii_digit()) {
        Some(idx_str.to_string())
    } else {
        None
    }
}

pub fn display_ordinal_for_index(display_index: u32) -> usize {
    if let Ok(displays) = list_displays() {
        if let Some(pos) = displays.iter().position(|d| d.index == display_index) {
            return pos;
        }
    }
    0
}

pub fn capture_display_preview(display_index: u32) -> AppResult<String> {
    #[cfg(target_os = "macos")]
    {
        let ordinal = display_ordinal_for_index(display_index);
        let display_num = (ordinal + 1).to_string();
        let tmp_path = std::env::temp_dir().join(format!(
            "open_recorder_preview_{}_{}.jpg",
            std::process::id(),
            display_index
        ));

        let status = Command::new("screencapture")
            .args(["-x", "-t", "jpg", "-D", &display_num])
            .arg(&tmp_path)
            .status()
            .map_err(|e| AppError::Recording(format!("Failed to run screencapture: {e}")))?;

        if !status.success() || !tmp_path.is_file() {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(AppError::Recording(
                "Screen Recording permission is required to preview this display".into(),
            ));
        }

        let _ = Command::new("sips")
            .args(["-Z", "1280"])
            .arg(&tmp_path)
            .output();

        let bytes = std::fs::read(&tmp_path)?;
        let _ = std::fs::remove_file(&tmp_path);
        if bytes.is_empty() {
            return Err(AppError::Recording("Captured preview image was empty".into()));
        }
        Ok(format!("data:image/jpeg;base64,{}", encode_base64(&bytes)))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = display_index;
        let ffmpeg = require_ffmpeg()?;
        let mut args = vec!["-nostdin".to_string(), "-y".to_string()];
        #[cfg(target_os = "windows")]
        args.extend(["-f".into(), "gdigrab".into(), "-i".into(), "desktop".into()]);
        #[cfg(target_os = "linux")]
        {
            let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0.0".into());
            args.extend(["-f".into(), "x11grab".into(), "-i".into(), display]);
        }
        args.extend([
            "-frames:v".into(),
            "1".into(),
            "-q:v".into(),
            "4".into(),
            "-vf".into(),
            "scale=1280:-2".into(),
            "-f".into(),
            "image2pipe".into(),
            "-vcodec".into(),
            "mjpeg".into(),
            "pipe:1".into(),
        ]);
        let output = Command::new(ffmpeg).args(&args).output()?;
        if !output.status.success() || output.stdout.is_empty() {
            return Err(AppError::Recording("Failed to capture display preview".into()));
        }
        Ok(format!(
            "data:image/jpeg;base64,{}",
            encode_base64(&output.stdout)
        ))
    }
}

fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[((triple >> 6) & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(triple & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    out
}

pub fn list_windows() -> AppResult<Vec<WindowInfo>> {
    #[cfg(target_os = "macos")]
    {
        Ok(macos_window_api::enumerate_windows())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

pub fn capture_window_preview(window_id: u32) -> AppResult<String> {
    #[cfg(target_os = "macos")]
    {
        let tmp_path = std::env::temp_dir().join(format!(
            "open_recorder_win_preview_{}_{}.jpg",
            std::process::id(),
            window_id
        ));
        let wid = window_id.to_string();
        let status = Command::new("screencapture")
            .args(["-x", "-t", "jpg", "-l", &wid])
            .arg(&tmp_path)
            .status()
            .map_err(|e| AppError::Recording(format!("Failed to run screencapture: {e}")))?;

        if !status.success() || !tmp_path.is_file() {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(AppError::Recording(
                "Unable to capture preview for this window".into(),
            ));
        }

        let _ = Command::new("sips")
            .args(["-Z", "1280"])
            .arg(&tmp_path)
            .output();

        let bytes = std::fs::read(&tmp_path)?;
        let _ = std::fs::remove_file(&tmp_path);
        if bytes.is_empty() {
            return Err(AppError::Recording("Captured window preview was empty".into()));
        }
        Ok(format!("data:image/jpeg;base64,{}", encode_base64(&bytes)))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window_id;
        Err(AppError::Recording(
            "Window preview is currently supported on macOS".into(),
        ))
    }
}

#[cfg(target_os = "macos")]
mod macos_window_api {
    use std::ffi::{c_void, CStr, CString};
    use crate::models::WindowInfo;

    type CFTypeRef = *const c_void;
    type CFArrayRef = *const c_void;
    type CFDictionaryRef = *const c_void;
    type CFStringRef = *const c_void;
    type CFNumberRef = *const c_void;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct CGPoint {
        x: f64,
        y: f64,
    }

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct CGSize {
        width: f64,
        height: f64,
    }

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct CGRect {
        origin: CGPoint,
        size: CGSize,
    }

    const K_CG_WINDOW_LIST_OPTION_ON_SCREEN_ONLY: u32 = 1 << 0;
    const K_CG_WINDOW_LIST_EXCLUDE_DESKTOP_ELEMENTS: u32 = 1 << 4;
    const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
    const K_CF_NUMBER_SINT32_TYPE: isize = 3;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGWindowListCopyWindowInfo(option: u32, relative_to_window: u32) -> CFArrayRef;
        fn CGRectMakeWithDictionaryRepresentation(
            dict: CFDictionaryRef,
            rect: *mut CGRect,
        ) -> bool;
        fn CGGetActiveDisplayList(
            max_displays: u32,
            active_displays: *mut u32,
            display_count: *mut u32,
        ) -> i32;
        fn CGDisplayBounds(display: u32) -> CGRect;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFArrayGetCount(the_array: CFArrayRef) -> isize;
        fn CFArrayGetValueAtIndex(the_array: CFArrayRef, idx: isize) -> CFTypeRef;
        fn CFDictionaryGetValue(the_dict: CFDictionaryRef, key: CFTypeRef) -> CFTypeRef;
        fn CFStringCreateWithCString(
            alloc: CFTypeRef,
            c_str: *const i8,
            encoding: u32,
        ) -> CFStringRef;
        fn CFStringGetCString(
            the_string: CFStringRef,
            buffer: *mut i8,
            buffer_size: isize,
            encoding: u32,
        ) -> bool;
        fn CFNumberGetValue(
            number: CFNumberRef,
            the_type: isize,
            value_ptr: *mut c_void,
        ) -> bool;
        fn CFRelease(cf: CFTypeRef);
    }

    unsafe fn make_cf_string(s: &str) -> CFStringRef {
        let cstr = CString::new(s).unwrap_or_default();
        CFStringCreateWithCString(std::ptr::null(), cstr.as_ptr(), K_CF_STRING_ENCODING_UTF8)
    }

    unsafe fn cf_string_to_string(cf_str: CFStringRef) -> Option<String> {
        if cf_str.is_null() {
            return None;
        }
        let mut buf = [0i8; 512];
        if CFStringGetCString(cf_str, buf.as_mut_ptr(), buf.len() as isize, K_CF_STRING_ENCODING_UTF8)
        {
            Some(CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned())
        } else {
            None
        }
    }

    unsafe fn cf_number_to_i32(cf_num: CFNumberRef) -> Option<i32> {
        if cf_num.is_null() {
            return None;
        }
        let mut val: i32 = 0;
        if CFNumberGetValue(cf_num, K_CF_NUMBER_SINT32_TYPE, &mut val as *mut i32 as *mut c_void) {
            Some(val)
        } else {
            None
        }
    }

    pub fn enumerate_windows() -> Vec<WindowInfo> {
        let mut windows = Vec::new();
        let displays = super::list_displays().unwrap_or_default();

        unsafe {
            let mut active_ids = [0u32; 16];
            let mut active_count: u32 = 0;
            let _ = CGGetActiveDisplayList(16, active_ids.as_mut_ptr(), &mut active_count);
            let display_bounds: Vec<(usize, CGRect)> = active_ids[..active_count as usize]
                .iter()
                .enumerate()
                .map(|(ord, &cg_id)| (ord, CGDisplayBounds(cg_id)))
                .collect();

            let list = CGWindowListCopyWindowInfo(
                K_CG_WINDOW_LIST_OPTION_ON_SCREEN_ONLY | K_CG_WINDOW_LIST_EXCLUDE_DESKTOP_ELEMENTS,
                0,
            );
            if list.is_null() {
                return windows;
            }

            let key_number = make_cf_string("kCGWindowNumber");
            let key_owner = make_cf_string("kCGWindowOwnerName");
            let key_name = make_cf_string("kCGWindowName");
            let key_layer = make_cf_string("kCGWindowLayer");
            let key_bounds = make_cf_string("kCGWindowBounds");

            let count = CFArrayGetCount(list);
            for i in 0..count {
                let dict = CFArrayGetValueAtIndex(list, i);
                if dict.is_null() {
                    continue;
                }

                let layer = cf_number_to_i32(CFDictionaryGetValue(dict, key_layer)).unwrap_or(-1);
                if layer != 0 {
                    continue;
                }

                let Some(id) = cf_number_to_i32(CFDictionaryGetValue(dict, key_number)) else {
                    continue;
                };
                let app_name =
                    cf_string_to_string(CFDictionaryGetValue(dict, key_owner)).unwrap_or_default();
                let title =
                    cf_string_to_string(CFDictionaryGetValue(dict, key_name)).unwrap_or_default();

                if app_name.is_empty()
                    || app_name == "Open Recorder"
                    || app_name == "open-recorder-desktop"
                    || app_name == "Window Server"
                {
                    continue;
                }

                let bounds_dict = CFDictionaryGetValue(dict, key_bounds);
                let mut rect = CGRect::default();
                if bounds_dict.is_null()
                    || !CGRectMakeWithDictionaryRepresentation(bounds_dict, &mut rect)
                {
                    continue;
                }

                if rect.size.width < 120.0 || rect.size.height < 90.0 {
                    continue;
                }

                let cx = rect.origin.x + rect.size.width / 2.0;
                let cy = rect.origin.y + rect.size.height / 2.0;
                let matched_display = display_bounds.iter().find(|(_, b)| {
                    cx >= b.origin.x
                        && cx <= b.origin.x + b.size.width
                        && cy >= b.origin.y
                        && cy <= b.origin.y + b.size.height
                });

                let (rel_x, rel_y, display_index, display_name) =
                    if let Some((ord, b)) = matched_display {
                        let d_info = displays.get(*ord);
                        (
                            (rect.origin.x - b.origin.x).max(0.0).round() as i32,
                            (rect.origin.y - b.origin.y).max(0.0).round() as i32,
                            d_info.map(|d| d.index),
                            d_info.map(|d| d.name.clone()),
                        )
                    } else {
                        (
                            rect.origin.x.max(0.0).round() as i32,
                            rect.origin.y.max(0.0).round() as i32,
                            displays.first().map(|d| d.index),
                            displays.first().map(|d| d.name.clone()),
                        )
                    };

                windows.push(WindowInfo {
                    id: id as u32,
                    app_name,
                    title,
                    x: rel_x,
                    y: rel_y,
                    width: rect.size.width.round() as i32,
                    height: rect.size.height.round() as i32,
                    display_index,
                    display_name,
                });
            }

            CFRelease(key_number);
            CFRelease(key_owner);
            CFRelease(key_name);
            CFRelease(key_layer);
            CFRelease(key_bounds);
            CFRelease(list);
        }
        windows
    }
}
