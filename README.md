# Open Recorder

A lightweight, capture-first desktop screen recorder for macOS, Windows, and Linux.

![Open Recorder](docs/assets/open-recorder-preview.png)

## Features

- **Screen, Region & App Window Capture**: Record fullscreen, a custom `Region` (drag directly on preview or use the fullscreen selector), or an open application `Window` (with search and automatic multi-monitor detection), with live display preview, configurable resolution (`720p`, `1080p`, `4K`, `original`), FPS (`15`, `30`, `60`), and pause/resume.
- **Settings & Diagnostics Screen**: Inspect FFmpeg status, storage and library paths, OS privacy shortcuts, and default capture settings.
- **Microphone & Audio Monitoring**: Select audio input devices with a real-time microphone VU meter.
- **Mouse & Keystroke Overlays**: System-wide mouse click highlights, keystroke display, optional camera PiP, and live screen annotations.
- **Recordings Library & Export**: Automatic thumbnail generation, fast video trimming, and GIF export saved directly to disk.
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
            ├── db/           # SQLite repository (diesel + libsqlite3-sys bundled)
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

On first launch on macOS, grant the following permissions in **System Settings → Privacy & Security** (also accessible from the **Settings** tab or the **Grant Screen Permission** button):
- **Screen & System Audio Recording**: Required to preview displays and capture the screen.
  - When running in dev mode (`bun run desktop:dev`), enable the toggle for `open-recorder-desktop` and/or the terminal/IDE process running the command (e.g., Terminal, iTerm2, Antigravity).
  - When running the packaged `.app` (`bun run desktop:build`), enable **Open Recorder**.
  - Choose **Quit & Reopen** when prompted by macOS so the permission takes effect.
- **Microphone**: Required to record microphone audio.
- **Accessibility / Input Monitoring**: Required for global mouse and keyboard tracking (`rdev`).
