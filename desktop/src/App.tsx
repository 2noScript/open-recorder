import { useCallback, useEffect, useRef, useState } from "react"
import { emit, listen } from "@tauri-apps/api/event"
import { RecorderPage } from "@/components/recorder/recorder-page"
import { MiniBar } from "@/components/recorder/mini-bar"
import { MouseHighlighter } from "@/components/recorder/mouse-highlighter"
import { KeystrokeDisplay } from "@/components/recorder/keystroke-display"
import { RegionSelector } from "@/components/recorder/region-selector"
import {
  AnnotationTools,
  type AnnotationMode,
} from "@/components/recorder/annotation-tools"
import { Button } from "@/components/ui/button"
import { useCursorTracker } from "@/hooks/use-cursor-tracker"
import { useKeyboardTracker } from "@/hooks/use-keyboard-tracker"
import { useRegion, type Region } from "@/hooks/use-region"
import {
  renderStrokes,
  useAnnotationStrokes,
} from "@/hooks/use-annotation-strokes"
import {
  hideOverlayWindow,
  setOverlayIgnoreCursor,
  showMainWindow,
} from "@/lib/tauri"

function OverlayWindow() {
  const cursor = useCursorTracker()
  const keyboard = useKeyboardTracker()
  const annotation = useAnnotationStrokes()
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth || window.screen.width || 1920,
    height: window.innerHeight || window.screen.height || 1080,
  }))
  const region = useRegion(viewport.width, viewport.height)
  const { setRegion } = region

  const [annotating, setAnnotating] = useState(false)
  const [selectingRegion, setSelectingRegion] = useState(false)
  const [mode, setMode] = useState<AnnotationMode>("draw")
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    function onResize() {
      setViewport({
        width: window.innerWidth || window.screen.width || 1920,
        height: window.innerHeight || window.screen.height || 1080,
      })
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    let active = true
    const unlisteners: Array<() => void> = []

    listen<boolean>("toggle-annotation-mode", (event) => {
      if (!active) return
      setAnnotating(event.payload)
    }).then((fn) => {
      if (active) unlisteners.push(fn)
      else fn()
    })

    listen<Region | null>("open-region-selector", (event) => {
      if (!active) return
      setViewport({
        width: window.innerWidth || window.screen.width || 1920,
        height: window.innerHeight || window.screen.height || 1080,
      })
      if (event.payload) {
        setRegion(event.payload)
      }
      setSelectingRegion(true)
    }).then((fn) => {
      if (active) unlisteners.push(fn)
      else fn()
    })

    return () => {
      active = false
      for (const unlisten of unlisteners) unlisten()
    }
  }, [setRegion])

  const finishRegionSelection = useCallback(
    async (selected: Region | null) => {
      setSelectingRegion(false)
      await setOverlayIgnoreCursor(true).catch(() => {})
      await hideOverlayWindow().catch(() => {})
      await emit("region-selected", selected).catch(() => {})
      await showMainWindow().catch(() => {})
    },
    []
  )

  useEffect(() => {
    if (!annotating && !selectingRegion) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (selectingRegion) {
        finishRegionSelection(null)
        return
      }
      if (annotating) {
        setAnnotating(false)
        setOverlayIgnoreCursor(true).catch(() => {})
        emit("annotation-mode-changed", false).catch(() => {})
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [annotating, selectingRegion, finishRegionSelection])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderStrokes(ctx, annotation.strokes)
  }, [annotation.strokes])

  useEffect(() => {
    redraw()
  }, [redraw])

  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent">
      <div className="pointer-events-none fixed inset-0">
        <MouseHighlighter cursor={cursor} />
        <KeystrokeDisplay events={keyboard.events} />
      </div>

      {selectingRegion && (
        <div className="fixed inset-0 z-50">
          <RegionSelector
            region={region.region}
            onPointerDown={(e, handle) =>
              region.onPointerDown(
                e,
                handle as Parameters<typeof region.onPointerDown>[1]
              )
            }
            onCreate={region.onPointerDownCreate}
            onReset={() => {
              region.reset()
              finishRegionSelection(null)
            }}
            screenWidth={viewport.width}
            screenHeight={viewport.height}
          />
          <div className="fixed bottom-8 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
            <span className="text-xs text-muted-foreground">
              {region.region
                ? `${Math.round(region.region.width)} × ${Math.round(region.region.height)}`
                : "Drag anywhere on screen to select region"}
            </span>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => finishRegionSelection(null)}
            >
              Cancel (Esc)
            </Button>
            <Button
              size="xs"
              disabled={!region.region}
              onClick={() => finishRegionSelection(region.region)}
            >
              Confirm Region
            </Button>
          </div>
        </div>
      )}

      {annotating && (
        <>
          <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            onPointerDown={(e) => {
              if (mode === "none") return
              const color = mode === "draw" ? "#e74c3c" : "#f1c40f"
              const width = mode === "highlight" ? 24 : 4
              annotation.startStroke(mode, { x: e.clientX, y: e.clientY }, color, width)
            }}
            onPointerMove={(e) => {
              if (mode === "none") return
              annotation.addPoint({ x: e.clientX, y: e.clientY })
              redraw()
            }}
            onPointerUp={() => annotation.endStroke()}
            className="fixed inset-0 z-40 cursor-crosshair"
          />
          <AnnotationTools
            mode={mode}
            onChange={setMode}
            onUndo={annotation.undo}
            canUndo={annotation.strokes.length > 0}
          />
        </>
      )}
    </div>
  )
}

export function App() {
  const params = new URLSearchParams(window.location.search)
  const win = params.get("window")

  if (win === "overlay") {
    return <OverlayWindow />
  }
  if (win === "mini-bar") {
    return <MiniBar />
  }
  return <RecorderPage />
}

export default App
