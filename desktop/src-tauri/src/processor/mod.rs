use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{AppError, AppResult};

pub fn resolve_binary(name: &str) -> Option<PathBuf> {
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    let extra_dirs = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
    ];
    for dir in extra_dirs {
        let candidate = Path::new(dir).join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

pub fn require_ffmpeg() -> AppResult<PathBuf> {
    resolve_binary("ffmpeg").ok_or_else(|| {
        AppError::Ffmpeg("FFmpeg binary not found in PATH or /opt/homebrew/bin".into())
    })
}

pub fn generate_thumbnail(video_path: &Path, output_path: &Path) -> AppResult<()> {
    let ffmpeg = require_ffmpeg()?;
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let output = Command::new(&ffmpeg)
        .args([
            "-y",
            "-ss",
            "0.5",
            "-i",
            &video_path.to_string_lossy(),
            "-vframes",
            "1",
            "-q:v",
            "3",
            "-vf",
            "scale=480:-1",
            &output_path.to_string_lossy(),
        ])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Ffmpeg(format!(
            "Failed to generate thumbnail: {stderr}"
        )));
    }
    Ok(())
}

pub fn trim_video(
    input_path: &Path,
    output_path: &Path,
    start_sec: f64,
    end_sec: f64,
) -> AppResult<()> {
    if end_sec <= start_sec || start_sec < 0.0 {
        return Err(AppError::InvalidInput(
            "Invalid trim range: end_sec must be greater than start_sec".into(),
        ));
    }

    let ffmpeg = require_ffmpeg()?;
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let duration = end_sec - start_sec;
    let output = Command::new(&ffmpeg)
        .args([
            "-y",
            "-ss",
            &format!("{start_sec:.3}"),
            "-i",
            &input_path.to_string_lossy(),
            "-t",
            &format!("{duration:.3}"),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            &output_path.to_string_lossy(),
        ])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Ffmpeg(format!("Failed to trim video: {stderr}")));
    }
    Ok(())
}

pub fn export_gif(
    input_path: &Path,
    output_path: &Path,
    start_sec: Option<f64>,
    end_sec: Option<f64>,
    fps: u32,
    width: u32,
) -> AppResult<()> {
    let ffmpeg = require_ffmpeg()?;
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut args: Vec<String> = vec!["-y".into()];
    if let Some(start) = start_sec {
        args.push("-ss".into());
        args.push(format!("{start:.3}"));
    }
    if let (Some(start), Some(end)) = (start_sec, end_sec) {
        if end > start {
            args.push("-t".into());
            args.push(format!("{:.3}", end - start));
        }
    }

    let vf = format!(
        "fps={fps},scale={width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5"
    );

    args.extend([
        "-i".into(),
        input_path.to_string_lossy().into_owned(),
        "-vf".into(),
        vf,
        "-loop".into(),
        "0".into(),
        output_path.to_string_lossy().into_owned(),
    ]);

    let output = Command::new(&ffmpeg).args(&args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Ffmpeg(format!("Failed to export GIF: {stderr}")));
    }
    Ok(())
}

pub fn probe_duration_ms(video_path: &Path) -> AppResult<i64> {
    let ffprobe = resolve_binary("ffprobe").ok_or_else(|| {
        AppError::Ffmpeg("ffprobe binary not found".into())
    })?;
    let output = Command::new(&ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            &video_path.to_string_lossy(),
        ])
        .output()?;

    if !output.status.success() {
        return Ok(0);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let secs: f64 = stdout.trim().parse().unwrap_or(0.0);
    Ok((secs * 1000.0).round() as i64)
}
