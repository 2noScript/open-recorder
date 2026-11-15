import { useCallback, useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import type { Recording } from "@/lib/db"
import type { Region } from "@/hooks/use-region"
import {
  pauseDesktopRecording,
  resumeDesktopRecording,
  setInputTracking,
  startDesktopRecording,
  stopDesktopRecording,
} from "@/lib/tauri"

export type RecorderStatus = "idle" | "recording" | "paused" | "done"

export interface RecordingConfig {
  resolution: "720p" | "1080p" | "4K" | "original"
  fps: 15 | 30 | 60
  micEnabled: boolean
  micDeviceId: string
  systemAudio: boolean

  mode: "fullscreen" | "region"
  countdown: number
  showMouseHighlight: boolean
  showKeystrokes: boolean
  cameraEnabled: boolean
  cameraDeviceId: string
  watermarkEnabled: boolean
  watermarkText: string
  watermarkOpacity: number
  annotationsEnabled: boolean
}

export const RESOLUTION_PRESETS: Record<
  string,
  { width: number; height: number } | null
> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4K": { width: 3840, height: 2160 },
  original: null,
}

export const DEFAULT_CONFIG: RecordingConfig = {
  resolution: "1080p",
  fps: 30,
  micEnabled: false,
  micDeviceId: "",
  systemAudio: true,

  mode: "fullscreen",
  countdown: 0,
  showMouseHighlight: false,
  showKeystrokes: false,
  cameraEnabled: false,
  cameraDeviceId: "",
  watermarkEnabled: false,
  watermarkText: "Open Recorder",
  watermarkOpacity: 0.3,
  annotationsEnabled: false,
}

export function useScreenRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle")
  const [recording, setRecording] = useState<Recording | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  const cleanupListener = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => cleanupListener()
  }, [cleanupListener])

  const start = useCallback(
    async (config: RecordingConfig, region: Region | null = null) => {
      setError(null)
      setRecording(null)
      setElapsed(0)
      setFileSize(0)

      cleanupListener()
      const unlisten = await listen<{
        elapsed: number
        fileSize: number
        status: string
      }>("recording-progress", (event) => {
        setElapsed(event.payload.elapsed)
        setFileSize(event.payload.fileSize)
      })
      unlistenRef.current = unlisten

      await setInputTracking(
        config.showMouseHighlight,
        config.showKeystrokes
      ).catch(() => {})

      await startDesktopRecording({
        resolution: config.resolution,
        fps: config.fps,
        micEnabled: config.micEnabled,
        micDeviceId: config.micDeviceId,
        systemAudio: config.systemAudio,
        mode: config.mode,
        region: region
          ? {
              x: Math.round(region.x),
              y: Math.round(region.y),
              width: Math.round(region.width),
              height: Math.round(region.height),
            }
          : null,
        displayIndex: null,
      })

      setStatus("recording")
    },
    [cleanupListener]
  )

  const pause = useCallback(async () => {
    await pauseDesktopRecording()
    setStatus("paused")
  }, [])

  const resume = useCallback(async () => {
    await resumeDesktopRecording()
    setStatus("recording")
  }, [])

  const stop = useCallback(async () => {
    cleanupListener()
    await setInputTracking(false, false).catch(() => {})
    const saved = await stopDesktopRecording()
    setRecording(saved)
    setElapsed(saved.duration)
    setFileSize(saved.size)
    setStatus("done")
    return saved
  }, [cleanupListener])

  const reset = useCallback(() => {
    cleanupListener()
    setRecording(null)
    setElapsed(0)
    setFileSize(0)
    setError(null)
    setStatus("idle")
  }, [cleanupListener])

  return {
    status,
    recording,
    elapsed,
    fileSize,
    error,
    mimeType: "video/mp4",
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
