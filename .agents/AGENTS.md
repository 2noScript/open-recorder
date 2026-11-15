# Working Guidelines for Open Recorder

Read the relevant sections before making changes. Use the current source code and manifests to verify file paths, commands, and feature names.

## Project Structure

- `desktop/` contains the entire Desktop application (React frontend + Rust Tauri v2 backend).
  - `desktop/src/` contains the React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui interface (built with Vite). Inside `desktop/src/`, `@/` resolves to `desktop/src/`.
    - `desktop/src/components/ui/` contains shadcn/ui primitive components.
    - `desktop/src/components/recorder/` contains recorder feature components (screen recording controls, overlays, audio mixer, preview, video trimming, GIF export, and recording history).
    - `desktop/src/hooks/` contains state orchestration hooks and IPC communication with Rust via `@tauri-apps/api` (`invoke` / `listen`).
    - `desktop/src/lib/` contains shared utilities, typed Tauri command wrappers, and the SQLite storage client layer.
  - `desktop/src-tauri/` contains the Rust backend (Tauri v2), pointing `frontendDist` to `../dist` and `devUrl` to `http://localhost:5173`.
    - `desktop/src-tauri/src/commands/` contains `#[tauri::command]` handlers exposed to the React UI.
    - `desktop/src-tauri/src/capture/` contains screen recording, system audio, and microphone capture/monitoring logic (FFmpeg + `cpal`).
    - `desktop/src-tauri/src/input_hooks/` contains global mouse & keyboard tracking (`rdev`) for system-wide mouse highlighting and keystroke display.
    - `desktop/src-tauri/src/processor/` contains FFmpeg post-processing (video trimming, thumbnail generation, GIF export).
    - `desktop/src-tauri/src/db/` contains SQLite (`diesel` + `libsqlite3-sys` with `bundled` feature) for recording metadata; video and thumbnail files are stored directly on disk.

## Code & Data Conventions

- Desktop-only application (do not maintain Web/PWA branches or IndexedDB/Dexie).
- Use kebab-case file names such as `recording-controls.tsx` and `use-screen-recorder.ts`. Keep file names required by Cargo, Tauri, or FFmpeg.
- Place all system-level operations (screen capture, audio recording, file I/O, SQLite, FFmpeg, global input hooks) in the Rust backend under `desktop/src-tauri/src/`; validate payloads at the `commands/` boundary.
- Store recording metadata (`name`, `file_path`, `thumbnail_path`, `mime_type`, `duration`, `size`, `created_at`) in SQLite; play back videos directly from disk via `convertFileSrc()` instead of holding large `Blob` objects in RAM.
- Reuse existing components and hooks; register listeners and timers per lifecycle and clean them up thoroughly when stopping recording or closing windows.
- Only report success after file writes, SQLite persistence, or video/GIF exports have actually completed; handle error paths and OS permissions cleanly (Screen Recording, Microphone, Camera, Accessibility on macOS).

## UI Standards

- Use the Script Pro color palette defined in [desktop/src/index.css](../desktop/src/index.css). In dark mode: frame `#181818`, sidebar/nav `#202020`, card/panel `#262626`, secondary/toolbar `#2e2e2e`, popover/dialog `#333333`, border/muted `#363636`, and teal `#36b5ba` (`#087e85` in light mode) for primary actions and active states. Support both light and dark modes via `theme-provider.tsx`.
- Use bundled `Inter Variable` (`@fontsource-variable/inter`). Keep root font size at `16px`; use `12px`/`18px` for body, buttons, inputs, menus, and list items, `11px`/`16px` for captions, and `14px`/`20px` for card/dialog titles.
- Use `4px` radius (`rounded-sm`) for buttons and inputs, `6px` (`rounded-md`) for menus, and `8px` (`--radius: 0.5rem`, `rounded-lg`) for panels and dialogs.
- Keep UI consistent with `shadcn/ui` in `desktop/src/components/ui/` and `lucide-react` icons; provide clear `aria-label` or tooltips for icon-only buttons.
- The recording overlay window (`/?window=overlay`: mouse highlighter, keystroke display) must manage mouse pass-through (`setIgnoreCursorEvents`) so it does not block clicks to underlying applications while recording.

## Verification

- Frontend, from `desktop/`: `bun run typecheck`, `bun run lint`, `bun run build`.
- Rust backend, from `desktop/src-tauri/`: `cargo check`, `cargo test`, `cargo clippy`.
- End-to-end desktop testing from `desktop/`: `bun run desktop:dev` / `bun run desktop:build` to verify OS permissions, screen capture, SQLite persistence, preview, trimming, and GIF export.
