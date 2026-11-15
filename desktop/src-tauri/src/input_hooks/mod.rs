use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use rdev::{listen, Button, EventType, Key};
use tauri::{AppHandle, Emitter};

use crate::models::{CursorEventPayload, KeystrokeEventPayload};

pub struct InputTracker {
    track_mouse: Arc<AtomicBool>,
    track_keyboard: Arc<AtomicBool>,
    started: AtomicBool,
}

impl InputTracker {
    pub fn new() -> Self {
        Self {
            track_mouse: Arc::new(AtomicBool::new(false)),
            track_keyboard: Arc::new(AtomicBool::new(false)),
            started: AtomicBool::new(false),
        }
    }

    pub fn set_tracking(&self, mouse: bool, keyboard: bool, app: &AppHandle) {
        self.track_mouse.store(mouse, Ordering::SeqCst);
        self.track_keyboard.store(keyboard, Ordering::SeqCst);

        if (mouse || keyboard) && !self.started.swap(true, Ordering::SeqCst) {
            self.spawn_listener(app.clone());
        }
    }

    fn spawn_listener(&self, app: AppHandle) {
        let track_mouse = Arc::clone(&self.track_mouse);
        let track_keyboard = Arc::clone(&self.track_keyboard);

        std::thread::spawn(move || {
            let mut last_x = 0.0_f64;
            let mut last_y = 0.0_f64;

            let callback = move |event: rdev::Event| {
                let mouse_on = track_mouse.load(Ordering::Relaxed);
                let key_on = track_keyboard.load(Ordering::Relaxed);
                if !mouse_on && !key_on {
                    return;
                }

                match event.event_type {
                    EventType::MouseMove { x, y } if mouse_on => {
                        last_x = x;
                        last_y = y;
                        let _ = app.emit(
                            "global-cursor",
                            CursorEventPayload {
                                x,
                                y,
                                event_type: "move".into(),
                                button: None,
                            },
                        );
                    }
                    EventType::ButtonPress(btn) if mouse_on => {
                        let _ = app.emit(
                            "global-cursor",
                            CursorEventPayload {
                                x: last_x,
                                y: last_y,
                                event_type: "down".into(),
                                button: Some(format_button(btn)),
                            },
                        );
                    }
                    EventType::ButtonRelease(btn) if mouse_on => {
                        let _ = app.emit(
                            "global-cursor",
                            CursorEventPayload {
                                x: last_x,
                                y: last_y,
                                event_type: "up".into(),
                                button: Some(format_button(btn)),
                            },
                        );
                    }
                    EventType::KeyPress(key) if key_on => {
                        let ts = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        let _ = app.emit(
                            "global-keystroke",
                            KeystrokeEventPayload {
                                key: format_key(key),
                                timestamp: ts,
                            },
                        );
                    }
                    _ => {}
                }
            };

            if let Err(err) = listen(callback) {
                eprintln!("[input_hooks] global rdev listener error: {err:?}");
            }
        });
    }
}

fn format_button(btn: Button) -> String {
    match btn {
        Button::Left => "left".into(),
        Button::Right => "right".into(),
        Button::Middle => "middle".into(),
        Button::Unknown(code) => format!("button_{code}"),
    }
}

fn format_key(key: Key) -> String {
    match key {
        Key::Alt | Key::AltGr => "Alt".into(),
        Key::Backspace => "Backspace".into(),
        Key::CapsLock => "CapsLock".into(),
        Key::ControlLeft | Key::ControlRight => "Ctrl".into(),
        Key::Delete => "Delete".into(),
        Key::DownArrow => "↓".into(),
        Key::End => "End".into(),
        Key::Escape => "Esc".into(),
        Key::Home => "Home".into(),
        Key::LeftArrow => "←".into(),
        Key::MetaLeft | Key::MetaRight => {
            if cfg!(target_os = "macos") {
                "⌘".into()
            } else {
                "Win".into()
            }
        }
        Key::PageDown => "PgDn".into(),
        Key::PageUp => "PgUp".into(),
        Key::Return => "Enter".into(),
        Key::RightArrow => "→".into(),
        Key::ShiftLeft | Key::ShiftRight => "Shift".into(),
        Key::Space => "Space".into(),
        Key::Tab => "Tab".into(),
        Key::UpArrow => "↑".into(),
        Key::KeyA => "A".into(),
        Key::KeyB => "B".into(),
        Key::KeyC => "C".into(),
        Key::KeyD => "D".into(),
        Key::KeyE => "E".into(),
        Key::KeyF => "F".into(),
        Key::KeyG => "G".into(),
        Key::KeyH => "H".into(),
        Key::KeyI => "I".into(),
        Key::KeyJ => "J".into(),
        Key::KeyK => "K".into(),
        Key::KeyL => "L".into(),
        Key::KeyM => "M".into(),
        Key::KeyN => "N".into(),
        Key::KeyO => "O".into(),
        Key::KeyP => "P".into(),
        Key::KeyQ => "Q".into(),
        Key::KeyR => "R".into(),
        Key::KeyS => "S".into(),
        Key::KeyT => "T".into(),
        Key::KeyU => "U".into(),
        Key::KeyV => "V".into(),
        Key::KeyW => "W".into(),
        Key::KeyX => "X".into(),
        Key::KeyY => "Y".into(),
        Key::KeyZ => "Z".into(),
        Key::Num0 | Key::Kp0 => "0".into(),
        Key::Num1 | Key::Kp1 => "1".into(),
        Key::Num2 | Key::Kp2 => "2".into(),
        Key::Num3 | Key::Kp3 => "3".into(),
        Key::Num4 | Key::Kp4 => "4".into(),
        Key::Num5 | Key::Kp5 => "5".into(),
        Key::Num6 | Key::Kp6 => "6".into(),
        Key::Num7 | Key::Kp7 => "7".into(),
        Key::Num8 | Key::Kp8 => "8".into(),
        Key::Num9 | Key::Kp9 => "9".into(),
        other => format!("{other:?}"),
    }
}
