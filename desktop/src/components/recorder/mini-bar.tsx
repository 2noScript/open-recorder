import { useEffect, useState } from "react"
import { emit, listen } from "@tauri-apps/api/event"
import { Button } from "@/components/ui/button"
import { PauseIcon, PencilIcon, PlayIcon, SquareIcon } from "lucide-react"
import {
  hideMiniBar,
  pauseDesktopRecording,
  resumeDesktopRecording,
  setOverlayIgnoreCursor,
  showMainWindow,
  showOverlayWindow,
  stopDesktopRecording,
} from "@/lib/tauri"

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MiniBar() {
  const [elapsed, setElapsed] = useState(0)
  const [fileSize, setFileSize] = useState(0)
  const [paused, setPaused] = useState(false)
  const [annotating, setAnnotating] = useState(false)

  useEffect(() => {
    let active = true
    const unlisteners: Array<() => void> = []

    listen<{ elapsed: number; fileSize: number; status: string }>(
      "recording-progress",
      (event) => {
        if (!active) return
        setElapsed(event.payload.elapsed)
        setFileSize(event.payload.fileSize)
      }
    ).then((fn) => {
      if (active) unlisteners.push(fn)
      else fn()
    })

    listen<boolean>("annotation-mode-changed", (event) => {
      if (!active) return
      setAnnotating(event.payload)
    }).then((fn) => {
      if (active) unlisteners.push(fn)
      else fn()
    })

    return () => {
      active = false
      for (const unlisten of unlisteners) unlisten()
    }
  }, [])

  async function handleTogglePause() {
    if (paused) {
      await resumeDesktopRecording()
      setPaused(false)
    } else {
      await pauseDesktopRecording()
      setPaused(true)
    }
  }

  async function handleToggleAnnotate() {
    const next = !annotating
    setAnnotating(next)
    if (next) {
      await showOverlayWindow().catch(() => {})
      await setOverlayIgnoreCursor(false).catch(() => {})
    } else {
      await setOverlayIgnoreCursor(true).catch(() => {})
    }
    await emit("toggle-annotation-mode", next)
  }

  async function handleStop() {
    setAnnotating(false)
    await stopDesktopRecording()
    await hideMiniBar()
    await showMainWindow()
  }

  return (
    <div
      data-tauri-drag-region
      className="flex h-screen w-screen items-center justify-between gap-3 rounded-lg border border-border bg-card/95 px-3 shadow-xl backdrop-blur"
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span
          className={`size-2.5 rounded-full ${
            paused ? "bg-amber-400" : "animate-pulse bg-destructive"
          }`}
        />
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {formatTime(elapsed)}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatSize(fileSize)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant={annotating ? "default" : "secondary"}
          size="xs"
          onClick={handleToggleAnnotate}
          aria-label="Toggle screen annotations"
          title="Annotate screen"
        >
          <PencilIcon className="size-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="xs"
          onClick={handleTogglePause}
          aria-label={paused ? "Resume recording" : "Pause recording"}
        >
          {paused ? (
            <PlayIcon className="size-3.5" />
          ) : (
            <PauseIcon className="size-3.5" />
          )}
        </Button>
        <Button
          variant="destructive"
          size="xs"
          onClick={handleStop}
          className="gap-1"
        >
          <SquareIcon className="size-3" />
          Stop
        </Button>
      </div>
    </div>
  )
}
