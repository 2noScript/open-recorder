# Open Recorder

A cross-platform desktop screen recorder built with **Tauri v2**, **Rust**, **React 19**, **TypeScript**, and **Tailwind CSS v4 / shadcn/ui**.

## Features

- **Native Screen & Audio Capture**: Record fullscreen or a custom `Region` with configurable resolution (`720p`, `1080p`, `4K`, `original`), FPS (`15`, `30`, `60`), pause/resume, and real-time recording progress via FFmpeg.
- **Microphone Monitoring (`cpal`)**: Enumerate audio input devices and stream real-time microphone VU meter levels.
- **Global Mouse & Keystroke Tracking (`rdev`)**: Transparent overlay window (`/?window=overlay`) for system-wide mouse click highlights and keystroke display.
- **Local SQLite Storage (`rusqlite`)**: Store recording metadata in SQLite (`open_recorder.db`) while saving `.mp4` videos and `.jpg` thumbnails directly to disk for zero-RAM-bloat playback.
- **FFmpeg Post-Processing**: Automatic thumbnail generation, fast video trimming (`-c copy`), and high-quality 2-pass palette GIF export.
- **System Tray**: Quick access to open the main window or quit from the system tray.

## Project Structure

```text
open-recorder/
├── .agents/
│   └── AGENTS.md             # Architecture and development guidelines
├── README.md
└── desktop/
    ├── package.json          # Frontend & Tauri CLI scripts
    ├── vite.config.ts
    ├── src/                  # React 19 + Tailwind v4 + shadcn/ui frontend
    │   ├── components/
    │   ├── hooks/
    │   └── lib/
    └── src-tauri/            # Rust backend (Tauri v2)
        ├── Cargo.toml
        ├── tauri.conf.json
        ├── capabilities/
        └── src/
            ├── capture/      # Screen & audio capture + Mic VU meter (cpal)
            ├── commands/     # #[tauri::command] handlers for the UI
            ├── db/           # SQLite repository (rusqlite bundled)
            ├── input_hooks/  # Global mouse & keyboard listener (rdev)
            └── processor/    # FFmpeg thumbnail, trim, and GIF export
```

## Prerequisites

- **Rust & Cargo** (stable)
- **Bun** (`>= 1.2`)
- **FFmpeg** (`ffmpeg` and `ffprobe` available in `PATH`, or `/opt/homebrew/bin` on macOS)

## Getting Started

```bash
cd desktop
bun install
bun run desktop:dev
```

## Building for Production

```bash
cd desktop
bun run desktop:build
```

## Verification

```bash
# Frontend (from desktop/)
cd desktop
bun run typecheck
bun run lint
bun run build

# Rust backend (from desktop/src-tauri/)
cd desktop/src-tauri
cargo check
cargo test
```

## macOS Permissions

On first launch on macOS, grant the following permissions in **System Settings → Privacy & Security**:
- **Screen Recording**: Required to capture the screen.
- **Microphone**: Required to record microphone audio.
- **Accessibility / Input Monitoring**: Required for global mouse and keyboard tracking (`rdev`).
