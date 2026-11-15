# Hướng dẫn làm việc với Open Recorder

Đọc phần liên quan trước khi sửa. Dùng mã nguồn và manifest hiện hành để xác nhận đường dẫn, lệnh và tên tính năng.

## Cấu trúc dự án

- `desktop/` chứa toàn bộ ứng dụng Desktop (Frontend React + Backend Rust Tauri v2).
  - `desktop/src/` chứa giao diện React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (build bằng Vite). Trong `desktop/src/`, `@/` trỏ tới `desktop/src/`.
    - `desktop/src/components/ui/` chứa các primitive component của shadcn/ui.
    - `desktop/src/components/recorder/` chứa các component nghiệp vụ quay màn hình, overlay, audio mixer, preview, cắt video, xuất GIF và lịch sử bản ghi.
    - `desktop/src/hooks/` chứa các hook điều phối trạng thái và giao tiếp IPC với Rust qua `@tauri-apps/api` (`invoke` / `listen`).
    - `desktop/src/lib/` chứa tiện ích dùng chung, wrapper Tauri commands và lớp gọi lưu trữ SQLite phía backend.
  - `desktop/src-tauri/` chứa backend Rust (Tauri v2), trỏ `frontendDist` tới `../dist` và `devUrl` tới `http://localhost:5173`.
    - `desktop/src-tauri/src/commands/` chứa các `#[tauri::command]` giao tiếp với giao diện React.
    - `desktop/src-tauri/src/capture/` chứa logic quay màn hình, system audio và micro (FFmpeg + `cpal`).
    - `desktop/src-tauri/src/input_hooks/` chứa global mouse & keyboard tracking (`rdev`) phục vụ highlight chuột và hiển thị phím bấm toàn hệ thống.
    - `desktop/src-tauri/src/processor/` chứa xử lý hậu kỳ bằng FFmpeg (cắt video, tạo thumbnail, xuất GIF).
    - `desktop/src-tauri/src/db/` chứa SQLite (`rusqlite` với feature `bundled`) lưu metadata bản ghi; file video và thumbnail lưu trực tiếp trên ổ cứng.

## Quy ước code và dữ liệu

- Chỉ phát triển phiên bản Desktop (không duy trì nhánh Web/PWA hay IndexedDB/Dexie).
- Dùng tên file kebab-case như `recording-controls.tsx`, `use-screen-recorder.ts`. Giữ tên mà Cargo, Tauri hoặc FFmpeg yêu cầu.
- Mọi thao tác hệ thống (quay màn hình, thu âm, ghi file, SQLite, FFmpeg, global input hooks) đặt ở backend Rust trong `desktop/src-tauri/src/`; kiểm tra và validate payload tại ranh giới `commands/`.
- Lưu metadata bản ghi (tên, `file_path`, `thumbnail_path`, `mime_type`, `duration`, `size`, `created_at`) trong SQLite; phát video trực tiếp từ đường dẫn file qua `convertFileSrc()`, không giữ `Blob` lớn trong RAM.
- Tái sử dụng component và hook hiện có; đăng ký listener/timer theo vòng đời và dọn dẹp đầy đủ khi dừng quay hoặc đóng cửa sổ.
- Chỉ báo thành công khi thao tác ghi file, lưu SQLite hoặc xuất video/GIF thực sự hoàn tất; xử lý đầy đủ nhánh lỗi và quyền hệ điều hành (Screen Recording, Microphone, Camera, Accessibility trên macOS).

## Chuẩn giao diện

- Dùng font `Inter Variable` (`@fontsource-variable/inter`) và hệ thống biến màu Tailwind v4 / shadcn trong [desktop/src/index.css](../desktop/src/index.css) (`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--destructive`, `--border`, `--radius`). Hỗ trợ đầy đủ chế độ sáng/tối qua `theme-provider.tsx`.
- Giữ nhất quán `shadcn/ui` trong `desktop/src/components/ui/` và icon `lucide-react`; đặt `aria-label` hoặc tooltip rõ ràng cho các nút chỉ có icon.
- Cửa sổ overlay quay màn hình (`/?window=overlay`: mouse highlighter, keystroke display) phải tách biệt quyền nhận chuột (`setIgnoreCursorEvents`) để không chặn thao tác xuống ứng dụng bên dưới khi đang quay.

## Kiểm tra

- Frontend, tại `desktop/`: `bun run typecheck`, `bun run lint`, `bun run build`.
- Desktop Rust, tại `desktop/src-tauri/`: `cargo check`, `cargo test`, `cargo clippy`.
- Chạy thử ứng dụng desktop từ `desktop/`: `bun run desktop:dev` / `bun run desktop:build` và kiểm tra thực tế luồng xin quyền, quay màn hình, lưu SQLite, preview, trim và export GIF.
