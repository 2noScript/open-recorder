import { useCallback, useEffect, useRef, useState } from "react"
import {
  useScreenRecorder,
  DEFAULT_CONFIG,
  RESOLUTION_PRESETS,
} from "@/hooks/use-screen-recorder"
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer"
import { useRecordingStorage } from "@/hooks/use-recording-storage"
import { useCursorTracker } from "@/hooks/use-cursor-tracker"
import { useKeyboardTracker } from "@/hooks/use-keyboard-tracker"
import { useRegion } from "@/hooks/use-region"
import { useCamera } from "@/hooks/use-camera"
import { useCanvasCompositor } from "@/hooks/use-canvas-compositor"
import { useAnnotationStrokes, renderStrokes } from "@/hooks/use-annotation-strokes"
import { saveRecording } from "@/lib/db"
import { generateVideoThumbnail } from "@/lib/generate-thumbnail"
import { RecordingSettings } from "@/components/recorder/recording-settings"
import { RecordingControls } from "@/components/recorder/recording-controls"
import { VideoPreview } from "@/components/recorder/video-preview"
import { RecordingHistory } from "@/components/recorder/recording-history"
import { MouseHighlighter } from "@/components/recorder/mouse-highlighter"
import { KeystrokeDisplay } from "@/components/recorder/keystroke-display"
import { CountdownOverlay } from "@/components/recorder/countdown-overlay"
import { RegionSelector } from "@/components/recorder/region-selector"
import { CameraOverlay } from "@/components/recorder/camera-overlay"
import { AudioMixer } from "@/components/recorder/audio-mixer"
import { AnnotationTools } from "@/components/recorder/annotation-tools"
import type { AnnotationMode } from "@/components/recorder/annotation-tools"
import { Button } from "@/components/ui/button"
import { HistoryIcon } from "lucide-react"
import type { RecordingConfig } from "@/hooks/use-screen-recorder"

type View = "record" | "history"

const SCREEN_W = window.screen.width
const SCREEN_H = window.screen.height

export function RecorderPage() {
  const [view, setView] = useState<View>("record")
  const [config, setConfig] = useState<RecordingConfig>(DEFAULT_CONFIG)
  const [showCountdown, setShowCountdown] = useState(false)
  const [pendingCountdown, setPendingCountdown] = useState(false)

  const recorder = useScreenRecorder()
  const analyzer = useAudioAnalyzer()
  const storage = useRecordingStorage()
  const [systemVolume, setSystemVolume] = useState(1.0)
  const [micVolume, setMicVolume] = useState(1.0)
  const cursor = useCursorTracker()
  const keyboard = useKeyboardTracker()
  const region = useRegion(SCREEN_W, SCREEN_H)
  const camera = useCamera()
  const compositor = useCanvasCompositor()
  const compositorCleanupRef = useRef<(() => void) | null>(null)
  const annotation = useAnnotationStrokes()
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>("none")
  const annotationRef = useRef<HTMLCanvasElement | null>(null)

  const handleAnnotationPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (annotationMode === "none") return
      const canvas = annotationRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const color = annotationMode === "draw" ? "#e74c3c" : "#f1c40f"
      const width = annotationMode === "highlight" ? 24 : 4
      annotation.startStroke(annotationMode, point, color, width)
    },
    [annotationMode, annotation]
  )

  const handleAnnotationPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (annotationMode === "none") return
      const canvas = annotationRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      annotation.addPoint(point)

      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      renderStrokes(ctx, annotation.strokes)
    },
    [annotationMode, annotation]
  )

  const handleAnnotationPointerUp = useCallback(() => {
    annotation.endStroke()
  }, [annotation])

  const configRef = useRef(config)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    if (config.cameraEnabled && !camera.stream && !camera.loading && !camera.error) {
      camera.start(config.cameraDeviceId || undefined)
    }
    if (!config.cameraEnabled && camera.stream) {
      camera.stop()
    }
  }, [config.cameraEnabled, config.cameraDeviceId, camera])

  useEffect(() => {
    compositor.updateOptions({
      cameraStream: config.cameraEnabled ? camera.stream : null,
      watermark: config.watermarkEnabled
        ? { text: config.watermarkText, color: "#ffffff", opacity: config.watermarkOpacity }
        : null,
    })
  }, [
    config.cameraEnabled,
    config.watermarkEnabled,
    config.watermarkText,
    config.watermarkOpacity,
    camera.stream,
    compositor,
  ])

  useEffect(() => {
    compositor.updateStrokes(annotation.strokes)
  }, [compositor, annotation.strokes])

  useEffect(() => {
    if (recorder.micStream && (recorder.status === "recording" || recorder.status === "paused")) {
      analyzer.start(recorder.micStream)
    } else {
      analyzer.stop()
    }
  }, [recorder.micStream, recorder.status, analyzer])

  useEffect(() => {
    if (recorder.status === "done" && recorder.blob) {
      const blob = recorder.blob
      generateVideoThumbnail(blob).then((thumbnail) => {
        saveRecording({
          name: `Recording ${new Date().toLocaleString()}`,
          blob,
          mimeType: recorder.mimeType,
          duration: recorder.elapsed,
          size: blob.size,
          thumbnail,
          createdAt: new Date(),
        }).catch(() => {})
      })
    }
  }, [recorder.status, recorder.blob, recorder.elapsed, recorder.mimeType])

  const doStart = useCallback(
    async (cfg: RecordingConfig) => {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: cfg.fps } },
          audio: cfg.systemAudio,
        })

        const needsCompositor =
          cfg.mode === "region" || cfg.cameraEnabled || cfg.watermarkEnabled

        if (needsCompositor) {
          const res = RESOLUTION_PRESETS[cfg.resolution]
          const tw = res?.width ?? 1920
          const th = res?.height ?? 1080

          const result = compositor.startCapture(
            displayStream,
            cfg.mode === "region" ? region.region : null,
            tw,
            th,
            cfg.fps
          )
          compositorCleanupRef.current = result.stop
          await recorder.start(result.stream, cfg)
          return
        }

        compositorCleanupRef.current = null
        await recorder.start(displayStream, cfg)
      } catch {
        recorder.reset()
      }
    },
    [compositor, region.region, recorder]
  )

  const handleStart = useCallback(() => {
    const cfg = configRef.current
    if (cfg.countdown > 0) {
      setShowCountdown(true)
      setPendingCountdown(true)
    } else {
      doStart(cfg)
    }
  }, [doStart])

  const handleCountdownDone = useCallback(() => {
    setShowCountdown(false)
    if (pendingCountdown) {
      setPendingCountdown(false)
      doStart(configRef.current)
    }
  }, [doStart, pendingCountdown])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey || !e.ctrlKey) return
      switch (e.key.toLowerCase()) {
        case "r":
          if (recorder.status === "idle" && view === "record") handleStart()
          break
        case "s":
          if (recorder.status === "recording" || recorder.status === "paused")
            recorder.stop()
          break
        case "p":
          if (recorder.status === "recording") recorder.pause()
          else if (recorder.status === "paused") recorder.resume()
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [recorder, handleStart, view])

  useEffect(() => {
    if (recorder.status === "idle" || recorder.status === "done") {
      compositorCleanupRef.current?.()
      compositorCleanupRef.current = null
    }
  }, [recorder.status])

  if (view === "history") {
    return (
      <div className="flex min-h-svh flex-col items-center p-6">
        <div className="mb-6 flex flex-col items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">🎥 Open Recorder</h1>
        </div>
        <RecordingHistory storage={storage} onBack={() => setView("record")} />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      {showCountdown && (
        <CountdownOverlay seconds={config.countdown} onDone={handleCountdownDone} />
      )}

      {config.mode === "region" && recorder.status === "idle" && (
        <RegionSelector
          region={region.region}
          onPointerDown={region.onPointerDown as (e: React.PointerEvent, handle: string) => void}
          screenWidth={SCREEN_W}
          screenHeight={SCREEN_H}
        />
      )}

      {config.showMouseHighlight && recorder.status !== "idle" && (
        <MouseHighlighter cursor={cursor} />
      )}

      {config.showKeystrokes && recorder.status !== "idle" && (
        <KeystrokeDisplay events={keyboard.events} />
      )}

      {config.cameraEnabled && recorder.status !== "idle" && (
        <CameraOverlay stream={camera.stream} loading={camera.loading} error={camera.error} />
      )}

      {(recorder.status === "recording" || recorder.status === "paused") && (
        <>
          <canvas
            ref={annotationRef}
            className={`fixed inset-0 z-40 ${annotationMode !== "none" ? "cursor-crosshair" : "pointer-events-none"}`}
            width={window.innerWidth}
            height={window.innerHeight}
            onPointerDown={handleAnnotationPointerDown}
            onPointerMove={handleAnnotationPointerMove}
            onPointerUp={handleAnnotationPointerUp}
            onPointerLeave={handleAnnotationPointerUp}
          />
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <AnnotationTools
              mode={annotationMode}
              onChange={setAnnotationMode}
              onUndo={annotation.undo}
              canUndo={annotation.strokes.length > 0}
            />
          </div>
        </>
      )}

      <div className="mb-8 flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">🎥 Open Recorder</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("history")}
            title="Recording History"
          >
            <HistoryIcon className="size-5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Record your screen directly in the browser
        </p>
      </div>

      {recorder.status === "idle" && (
        <RecordingSettings
          config={config}
          onChange={setConfig}
          onStart={handleStart}
          hasRegionSelected={region.region !== null}
        />
      )}

      {(recorder.status === "recording" || recorder.status === "paused") && (
        <div className="flex flex-col items-center gap-3">
          <RecordingControls
            status={recorder.status}
            elapsed={recorder.elapsed}
            fileSize={recorder.fileSize}
            volume={analyzer.volume}
            onPause={recorder.pause}
            onResume={recorder.resume}
            onStop={recorder.stop}
          />
          <AudioMixer
            micVolume={micVolume}
            systemVolume={systemVolume}
            onMicVolumeChange={(v) => {
              setMicVolume(v)
              recorder.setMicVolume(v)
            }}
            onSystemVolumeChange={(v) => {
              setSystemVolume(v)
              recorder.setSystemVolume(v)
            }}
            hasMic={config.micEnabled}
            hasSystemAudio={config.systemAudio}
          />
        </div>
      )}

      {recorder.status === "done" && recorder.blob && (
        <VideoPreview
          blob={recorder.blob}
          elapsed={recorder.elapsed}
          mimeType={recorder.mimeType}
          onReset={recorder.reset}
        />
      )}

      <div className="mt-8 text-xs text-muted-foreground">
        {recorder.status === "idle" && (
          <span>
            Press <kbd className="rounded border bg-muted px-1 font-mono">Ctrl+Shift+R</kbd> to start
          </span>
        )}
      </div>
    </div>
  )
}
