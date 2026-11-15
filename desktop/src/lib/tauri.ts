import { invoke } from "@tauri-apps/api/core"
import type { Recording } from "@/lib/db"

export interface DisplayInfo {
  index: number
  name: string
  isPrimary: boolean
}

export interface AudioDeviceInfo {
  id: string
  name: string
  isDefault: boolean
}

export interface DesktopRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface DesktopRecordingConfig {
  resolution: string
  fps: number
  micEnabled: boolean
  micDeviceId: string
  systemAudio: boolean
  mode: string
  region: DesktopRegion | null
  displayIndex: number | null
  watermarkText?: string | null
  watermarkOpacity?: number | null
}

export interface PermissionStatus {
  screenRecording: boolean
  microphone: boolean
  accessibility: boolean
}

export async function listDisplays(): Promise<DisplayInfo[]> {
  return invoke<DisplayInfo[]>("list_displays")
}

export async function listAudioDevices(): Promise<AudioDeviceInfo[]> {
  return invoke<AudioDeviceInfo[]>("list_audio_devices")
}

export async function startMicMonitor(deviceName: string | null): Promise<void> {
  return invoke<void>("start_mic_monitor", { deviceName })
}

export async function stopMicMonitor(): Promise<void> {
  return invoke<void>("stop_mic_monitor")
}

export async function startDesktopRecording(
  config: DesktopRecordingConfig
): Promise<string> {
  return invoke<string>("start_recording", { config })
}

export async function pauseDesktopRecording(): Promise<void> {
  return invoke<void>("pause_recording")
}

export async function resumeDesktopRecording(): Promise<void> {
  return invoke<void>("resume_recording")
}

export async function stopDesktopRecording(): Promise<Recording> {
  return invoke<Recording>("stop_recording")
}

export async function trimDesktopRecording(params: {
  recordingId: number
  startSec: number
  endSec: number
  outputName?: string
}): Promise<Recording> {
  return invoke<Recording>("trim_recording", { req: params })
}

export async function exportDesktopGif(params: {
  inputPath: string
  outputPath: string
  startSec?: number
  endSec?: number
  fps: number
  width: number
}): Promise<string> {
  return invoke<string>("export_gif", { req: params })
}

export async function setInputTracking(
  mouse: boolean,
  keyboard: boolean
): Promise<void> {
  return invoke<void>("set_input_tracking", { mouse, keyboard })
}

export async function setOverlayIgnoreCursor(ignore: boolean): Promise<void> {
  return invoke<void>("set_overlay_ignore_cursor", { ignore })
}

export async function showOverlayWindow(displayIndex?: number): Promise<void> {
  return invoke<void>("show_overlay_window", {
    displayIndex: displayIndex ?? null,
  })
}

export async function captureDisplayPreview(
  displayIndex: number
): Promise<string> {
  return invoke<string>("capture_display_preview", { displayIndex })
}

export interface WindowInfo {
  id: number
  appName: string
  title: string
  x: number
  y: number
  width: number
  height: number
  displayIndex: number | null
  displayName: string | null
}

export async function listWindows(): Promise<WindowInfo[]> {
  return invoke<WindowInfo[]>("list_windows")
}

export async function captureWindowPreview(windowId: number): Promise<string> {
  return invoke<string>("capture_window_preview", { windowId })
}

export async function hideOverlayWindow(): Promise<void> {
  return invoke<void>("hide_overlay_window")
}

export async function showMiniBar(): Promise<void> {
  return invoke<void>("show_mini_bar")
}

export async function hideMiniBar(): Promise<void> {
  return invoke<void>("hide_mini_bar")
}

export async function showMainWindow(): Promise<void> {
  return invoke<void>("show_main_window")
}

export async function hideMainWindow(): Promise<void> {
  return invoke<void>("hide_main_window")
}

export async function checkPermissions(): Promise<PermissionStatus> {
  return invoke<PermissionStatus>("check_permissions")
}

export async function openPrivacySettings(
  pane: "screen" | "mic" | "accessibility"
): Promise<void> {
  return invoke<void>("open_privacy_settings", { pane })
}

export async function getRecordingsDir(): Promise<string> {
  return invoke<string>("get_recordings_dir")
}

export async function openRecordingsDir(): Promise<void> {
  return invoke<void>("open_recordings_dir")
}

export interface SystemInfo {
  ffmpegInstalled: boolean
  ffmpegPath: string | null
  ffmpegVersion: string | null
  ffprobeInstalled: boolean
  ffprobePath: string | null
  hardwareEncoder: string | null
  recordingsDir: string
  dbPath: string
  os: string
  arch: string
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>("get_system_info")
}
