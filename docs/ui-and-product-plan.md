# Capture-First UI & Pro Screen Recorder Plan (Checklist)

Open Recorder is a **desktop-only, capture-first screen recorder** built with Tauri v2, Rust, React 19, Tailwind CSS v4, FFmpeg, and SQLite (`diesel` + `libsqlite3-sys` bundled). It focuses on fast, reliable screen & audio capture rather than a full video editor.

---

## 1. Architecture & Storage Foundation

- [x] Consolidate desktop frontend (`desktop/src/`) and Rust backend (`desktop/src-tauri/`) inside `desktop/`.
- [x] Remove web-only dependencies (`dexie`, `gif.js`, `vite-plugin-pwa`).
- [x] Implement SQLite persistence (`open_recorder.db`) using `diesel` + `libsqlite3-sys` (`bundled`).
- [x] Store `.mp4` recordings and `.jpg` thumbnails directly on disk (`~/Movies/OpenRecorder/`).
- [x] Stream local video playback via `convertFileSrc()` instead of holding `Blob` objects in RAM.

---

## 2. Capture-First UI & Design System

- [x] Apply Script Pro color tokens (`#181818`, `#202020`, `#262626`, `#2e2e2e`, `#333333`, `#36b5ba` / `#087e85`), `Inter Variable` typography, and `4px`/`6px`/`8px` radii in [desktop/src/index.css](../desktop/src/index.css).
- [x] Build Top Bar (`Record` / `Recordings` / `Settings` switcher, FFmpeg/permission pill opening OS Privacy Settings, Light/Dark theme toggle).
- [x] Build 2-column Capture Studio (`StudioStage` with live display preview + multi-monitor thumbnail switcher + `StudioSettingsPanel` with `Video`, `Audio`, `Overlays`, `General` tabs).
- [x] Build dedicated `Settings` screen (`SettingsView`) displaying FFmpeg / `ffprobe` status, binary path, version, hardware encoder, SQLite & recordings paths, OS privacy shortcuts, and default recording parameters.
- [x] Build Bottom Capture Bar with `Start Recording`, live timer, file size, `Pause/Resume`, and `Stop`.
- [x] Build `Recordings` Library with search filter, inline `Play` (`VideoPreview`), `Rename`, `Show in Folder`, `Export`, and `Delete`.

---

## 3. Native Capture, Audio & Multi-Window Overlays

- [x] Display enumeration (`list_displays`), live screen preview (`capture_display_preview`), multi-monitor switcher, and per-display region overlay positioning (`show_overlay_window`).
- [x] Hardware-accelerated encoding (`h264_videotoolbox` on macOS with `libx264` fallback).
- [x] Real-time microphone monitoring (`cpal` `MicMonitor` + `VuMeter`).
- [x] Floating Mini Bar (`/?window=mini-bar`) that auto-hides main window on start and restores it on stop.
- [x] Transparent Overlay Window (`/?window=overlay`) with `set_overlay_ignore_cursor` pass-through toggle.
- [x] Global mouse & keyboard tracking (`rdev`) driving `MouseHighlighter` and `KeystrokeDisplay`.
- [x] Live screen annotations toggleable from the Mini Bar (`Annotate` button + `Esc` to exit).
- [x] Optional FFmpeg `drawtext` watermark filter burned into output video.
- [x] System-wide global hotkeys (`Cmd/Ctrl+Shift+R` Start/Stop, `Cmd/Ctrl+Shift+P` Pause/Resume) via `tauri-plugin-global-shortcut`.

---

## 4. Future / Optional Enhancements

- [ ] Native application window enumeration (`list_windows`) for single-window capture.
- [ ] Native macOS System Audio capture via ScreenCaptureKit alongside microphone mixing.
- [ ] Hardware NVENC/VAAPI encoder selection on Windows/Linux.
- [ ] Camera PiP composited directly into the FFmpeg output stream.
- [ ] Code signing, notarization, and release packaging (`.dmg`, `.msi`, `.AppImage`).
