use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::models::{AudioDeviceInfo, RecordingConfig, RecordingProgressPayload};
use crate::processor::require_ffmpeg;

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
    if config.mode == "region" {
        if let Some(region) = &config.region {
            if region.width > 0 && region.height > 0 {
                filters.push(format!(
                    "crop={}:{}:{}:{}",
                    region.width, region.height, region.x, region.y
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

    if !filters.is_empty() {
        args.push("-vf".into());
        args.push(filters.join(","));
    }

    args.extend([
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "ultrafast".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
    ]);

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
