import { useCallback, useEffect, useRef, useState } from "react"
import { emit, listen } from "@tauri-apps/api/event"
import {
  useScreenRecorder,
  DEFAULT_CONFIG,
  type RecordingConfig,
} from "@/hooks/use-screen-recorder"
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer"
import { useRecordingStorage } from "@/hooks/use-recording-storage"
import { useCursorTracker } from "@/hooks/use-cursor-tracker"
import { useKeyboardTracker } from "@/hooks/use-keyboard-tracker"
import { useRegion, type Region } from "@/hooks/use-region"
import { useCamera } from "@/hooks/use-camera"
import { useAnnotationStrokes, renderStrokes } from "@/hooks/use-annotation-strokes"
import { StudioStage } from "@/components/recorder/studio-stage"
import { StudioSettingsPanel } from "@/components/recorder/studio-settings-panel"
import { RecordingHistory } from "@/components/recorder/recording-history"
import { SettingsView } from "@/components/recorder/settings-view"
import { RecordingTimer } from "@/components/recorder/recording-timer"
import { MouseHighlighter } from "@/components/recorder/mouse-highlighter"
import { KeystrokeDisplay } from "@/components/recorder/keystroke-display"
import { CountdownOverlay } from "@/components/recorder/countdown-overlay"
import { CameraOverlay } from "@/components/recorder/camera-overlay"
import { AnnotationTools, type AnnotationMode } from "@/components/recorder/annotation-tools"
import { Button } from "@/components/ui/button"
import {
  hideMainWindow,
  hideMiniBar,
  openRecordingsDir,
  setOverlayIgnoreCursor,
  showMainWindow,
  showMiniBar,
  showOverlayWindow,
  startMicMonitor,
  stopMicMonitor,
  type WindowInfo,
} from "@/lib/tauri"
import {
  CircleIcon,
  FolderIcon,
  FolderOpenIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  SquareIcon,
} from "lucide-react"

type View = "record" | "history" | "settings"

const SCREEN_W = window.screen.width
const SCREEN_H = window.screen.height

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function RecorderPage() {
  const [view, setView] = useState<View>("record")
  const [config, setConfig] = useState<RecordingConfig>(DEFAULT_CONFIG)
  const [selectedDisplay, setSelectedDisplay] = useState(0)
  const [selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null)
  const [showCountdown, setShowCountdown] = useState(false)
  const [pendingCountdown, setPendingCountdown] = useState(false)

  const recorder = useScreenRecorder()
  const analyzer = useAudioAnalyzer()
  const storage = useRecordingStorage()
  const cursor = useCursorTracker()
  const keyboard = useKeyboardTracker()
  const region = useRegion(SCREEN_W, SCREEN_H)
  const camera = useCamera()
  const annotation = useAnnotationStrokes()
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>("none")
  const annotationRef = useRef<HTMLCanvasElement | null>(null)

  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

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

  useEffect(() => {
    if (config.cameraEnabled && !camera.stream && !camera.loading && !camera.error) {
      camera.start(config.cameraDeviceId || undefined)
    }
    if (!config.cameraEnabled && camera.stream) {
      camera.stop()
    }
  }, [config.cameraEnabled, config.cameraDeviceId, camera])

  useEffect(() => {
    if (
      config.micEnabled &&
      (recorder.status === "recording" || recorder.status === "paused")
    ) {
      analyzer.start().catch(() => {})
      startMicMonitor(config.micDeviceId || null).catch(() => {})
    } else {
      analyzer.stop()
      stopMicMonitor().catch(() => {})
    }
  }, [config.micEnabled, config.micDeviceId, recorder.status, analyzer])

  const doStart = useCallback(
    async (cfg: RecordingConfig) => {
      if (cfg.mode === "region" && !region.region) return
      if (cfg.mode === "window" && !selectedWindow) return
      const targetRegion =
        cfg.mode === "region" && region.region
          ? region.region
          : cfg.mode === "window" && selectedWindow
            ? {
                x: Math.max(0, selectedWindow.x),
                y: Math.max(0, selectedWindow.y),
                width: selectedWindow.width,
                height: selectedWindow.height,
              }
            : null
      try {
        await recorder.start(cfg, targetRegion, selectedDisplay)
        await hideMainWindow().catch(() => {})
        await showMiniBar().catch(() => {})
      } catch {
        recorder.reset()
      }
    },
    [region.region, recorder, selectedDisplay, selectedWindow]
  )

  const { refresh: refreshStorage } = storage
  const { reset: resetRecorder } = recorder

  useEffect(() => {
    let active = true
    let unlisten: (() => void) | null = null

    listen("recording-stopped", () => {
      if (!active) return
      refreshStorage().catch(() => {})
      setView("history")
      resetRecorder()
    }).then((fn) => {
      if (active) unlisten = fn
      else fn()
    })

    return () => {
      active = false
      unlisten?.()
    }
  }, [refreshStorage, resetRecorder])

  const handleStop = useCallback(async () => {
    await recorder.stop()
    await hideMiniBar().catch(() => {})
  }, [recorder])

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
      if (!e.shiftKey || !(e.ctrlKey || e.metaKey)) return
      switch (e.key.toLowerCase()) {
        case "r":
          if (recorder.status === "idle" && view === "record") handleStart()
          break
        case "s":
          if (recorder.status === "recording" || recorder.status === "paused") {
            handleStop()
          }
          break
        case "p":
          if (recorder.status === "recording") recorder.pause()
          else if (recorder.status === "paused") recorder.resume()
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [recorder, handleStart, handleStop, view])

  useEffect(() => {
    let active = true
    const unlisteners: Array<() => void> = []

    listen("shortcut-toggle-record", () => {
      if (!active) return
      if (recorder.status === "idle") handleStart()
      else if (recorder.status === "recording" || recorder.status === "paused") {
        handleStop()
      }
    }).then((fn) => {
      if (active) unlisteners.push(fn)
      else fn()
    })

    listen("shortcut-toggle-pause", () => {
      if (!active) return
      if (recorder.status === "recording") recorder.pause()
      else if (recorder.status === "paused") recorder.resume()
    }).then((fn) => {
      if (active) unlisteners.push(fn)
      else fn()
    })

    return () => {
      active = false
      for (const unlisten of unlisteners) unlisten()
    }
  }, [recorder, handleStart, handleStop])

  const canStart =
    recorder.status === "idle" &&
    (config.mode === "fullscreen" ||
      (config.mode === "region" && region.region !== null) ||
      (config.mode === "window" && selectedWindow !== null))

  const { setRegion } = region

  const openFullscreenRegionSelector = useCallback(async () => {
    try {
      await showOverlayWindow(selectedDisplay)
      await setOverlayIgnoreCursor(false)
      await new Promise((r) => setTimeout(r, 80))
      await emit("open-region-selector", region.region)
      await hideMainWindow().catch(() => {})
    } catch {
      await showMainWindow().catch(() => {})
    }
  }, [region.region, selectedDisplay])

  useEffect(() => {
    let active = true
    let unlisten: (() => void) | null = null

    listen<Region | null>("region-selected", (event) => {
      if (!active) return
      if (event.payload) {
        setRegion(event.payload)
      }
    }).then((fn) => {
      if (active) unlisten = fn
      else fn()
    })

    return () => {
      active = false
      unlisten?.()
    }
  }, [setRegion])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {showCountdown && (
        <CountdownOverlay
          seconds={config.countdown}
          onDone={handleCountdownDone}
        />
      )}

      {recorder.status !== "idle" && config.showMouseHighlight && (
        <MouseHighlighter cursor={cursor} />
      )}
      {recorder.status !== "idle" && config.showKeystrokes && (
        <KeystrokeDisplay events={keyboard.events} />
      )}
      {config.cameraEnabled && (
        <CameraOverlay
          stream={camera.stream}
          loading={camera.loading}
          error={camera.error}
        />
      )}

      {recorder.status === "recording" && config.annotationsEnabled && (
        <>
          <canvas
            ref={annotationRef}
            width={window.innerWidth}
            height={window.innerHeight}
            onPointerDown={handleAnnotationPointerDown}
            onPointerMove={handleAnnotationPointerMove}
            onPointerUp={handleAnnotationPointerUp}
            className="fixed inset-0 z-40"
            style={{
              pointerEvents: annotationMode !== "none" ? "auto" : "none",
              cursor: annotationMode !== "none" ? "crosshair" : "default",
            }}
          />
          <AnnotationTools
            mode={annotationMode}
            onChange={setAnnotationMode}
            onUndo={annotation.undo}
            canUndo={annotation.strokes.length > 0}
          />
        </>
      )}

      {/* Top Bar (Script Pro integrated titlebar) */}
      <header
        data-tauri-drag-region
        className="app-titlebar relative flex shrink-0 select-none items-center justify-end border-b border-border bg-sidebar pr-3 pl-[78px]"
      >
        <nav className="app-titlebar-no-drag absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-sm border border-border/70 bg-background/70 p-0.5">
          <button
            type="button"
            onClick={() => setView("record")}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors ${
              view === "record"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CircleIcon
              className={`size-2.5 ${
                recorder.status === "recording"
                  ? "fill-destructive text-destructive"
                  : view === "record"
                    ? "fill-primary text-primary"
                    : ""
              }`}
            />
            Record
          </button>
          <button
            type="button"
            onClick={() => {
              setView("history")
              storage.refresh().catch(() => {})
            }}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors ${
              view === "history"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderIcon className="size-3" />
            <span>Recordings</span>
            {storage.recordings.length > 0 && (
              <span className="rounded-sm bg-secondary px-1 text-[10px] tabular-nums text-muted-foreground">
                {storage.recordings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView("settings")}
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors ${
              view === "settings"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <SettingsIcon className="size-3" />
            Settings
          </button>
        </nav>

        <div className="app-titlebar-no-drag flex items-center gap-1.5">
          {recorder.status === "idle" && view === "record" && (
            <Button
              size="xs"
              onClick={handleStart}
              disabled={!canStart}
              title="Start Recording (⌘⇧R)"
              className="gap-1.5 rounded-sm bg-destructive px-2.5 text-white hover:bg-destructive/90"
            >
              <CircleIcon className="size-2.5 fill-current" />
              Start Recording
            </Button>
          )}

          {(recorder.status === "recording" || recorder.status === "paused") && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-0.5 text-[11px]">
                <RecordingTimer
                  elapsed={recorder.elapsed}
                  isPaused={recorder.status === "paused"}
                />
                <span className="tabular-nums text-muted-foreground">
                  {formatSize(recorder.fileSize)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={recorder.status === "paused" ? "Resume recording" : "Pause recording"}
                title={recorder.status === "paused" ? "Resume (⌘⇧P)" : "Pause (⌘⇧P)"}
                onClick={recorder.status === "paused" ? recorder.resume : recorder.pause}
                className="rounded-sm"
              >
                {recorder.status === "paused" ? (
                  <PlayIcon className="size-3" />
                ) : (
                  <PauseIcon className="size-3" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="xs"
                onClick={handleStop}
                title="Stop Recording (⌘⇧R)"
                className="gap-1 rounded-sm"
              >
                <SquareIcon className="size-2.5 fill-current" />
                Stop
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Open recordings folder"
            title="Open Recordings Folder"
            onClick={() => openRecordingsDir().catch(() => {})}
            className="text-muted-foreground hover:text-foreground"
          >
            <FolderOpenIcon className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Main Content (kept mounted so switching tabs is instant) */}
      <main
        className={
          view === "history"
            ? "flex-1 overflow-y-auto bg-background"
            : "hidden"
        }
      >
        <RecordingHistory
          storage={storage}
          onBack={() => setView("record")}
        />
      </main>

      <main
        className={
          view === "settings"
            ? "flex-1 overflow-y-auto bg-background"
            : "hidden"
        }
      >
        <SettingsView
          config={config}
          onChange={setConfig}
          disabled={recorder.status !== "idle"}
        />
      </main>

      <div className={view === "record" ? "flex min-h-0 flex-1" : "hidden"}>
        <StudioStage
          config={config}
          onChange={setConfig}
          status={recorder.status}
          region={region.region}
          onRegionChange={region.setRegion}
          selectedDisplay={selectedDisplay}
          onSelectDisplay={setSelectedDisplay}
          selectedWindow={selectedWindow}
          onSelectWindow={setSelectedWindow}
          onOpenRegionSelector={openFullscreenRegionSelector}
        />
        <StudioSettingsPanel
          config={config}
          onChange={setConfig}
          micVolume={analyzer.volume}
          disabled={recorder.status !== "idle"}
        />
      </div>
    </div>
  )
}
