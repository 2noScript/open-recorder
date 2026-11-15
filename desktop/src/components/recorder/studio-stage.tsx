import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  captureDisplayPreview,
  captureWindowPreview,
  listDisplays,
  listWindows,
  openPrivacySettings,
  type DisplayInfo,
  type WindowInfo,
} from "@/lib/tauri"
import type {
  RecordingConfig,
  RecorderStatus,
} from "@/hooks/use-screen-recorder"
import type { Region } from "@/hooks/use-region"
import {
  AppWindowIcon,
  CameraIcon,
  CropIcon,
  KeyboardIcon,
  MonitorIcon,
  MousePointerClickIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react"

interface StudioStageProps {
  config: RecordingConfig
  onChange: (next: RecordingConfig) => void
  status: RecorderStatus
  region: Region | null
  onRegionChange: (next: Region | null) => void
  selectedDisplay: number
  onSelectDisplay: (index: number) => void
  selectedWindow: WindowInfo | null
  onSelectWindow: (win: WindowInfo | null) => void
  onOpenRegionSelector: () => void
}

export function StudioStage({
  config,
  onChange,
  status,
  region,
  onRegionChange,
  selectedDisplay,
  onSelectDisplay,
  selectedWindow,
  onSelectWindow,
  onOpenRegionSelector,
}: StudioStageProps) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [previews, setPreviews] = useState<Record<number, string>>({})
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [windowPreviews, setWindowPreviews] = useState<Record<number, string>>({})
  const [windowQuery, setWindowQuery] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingWindows, setLoadingWindows] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewBoxRef = useRef<HTMLDivElement | null>(null)

  const refreshPreviews = useCallback(
    async (targetDisplays: DisplayInfo[], activeIndex: number) => {
      if (targetDisplays.length === 0) return
      setLoadingPreview(true)
      setPreviewError(null)
      try {
        const entries = await Promise.allSettled(
          targetDisplays.map(async (d) => {
            const dataUrl = await captureDisplayPreview(d.index)
            return [d.index, dataUrl] as const
          })
        )
        const next: Record<number, string> = {}
        let activeFailed: string | null = null
        entries.forEach((res, i) => {
          const idx = targetDisplays[i].index
          if (res.status === "fulfilled") {
            next[res.value[0]] = res.value[1]
          } else if (idx === activeIndex) {
            activeFailed =
              res.reason instanceof Error
                ? res.reason.message
                : String(res.reason)
          }
        })
        setPreviews((prev) => ({ ...prev, ...next }))
        if (activeFailed && !next[activeIndex]) {
          setPreviewError(activeFailed)
        }
      } finally {
        setLoadingPreview(false)
      }
    },
    []
  )

  const initialDisplayRef = useRef(selectedDisplay)
  const onSelectDisplayRef = useRef(onSelectDisplay)
  useEffect(() => {
    onSelectDisplayRef.current = onSelectDisplay
  }, [onSelectDisplay])

  useEffect(() => {
    let cancelled = false
    listDisplays()
      .then((list) => {
        if (cancelled) return
        setDisplays(list)
        const currentSelected = initialDisplayRef.current
        const activeIdx =
          list.length > 0 && !list.some((d) => d.index === currentSelected)
            ? list[0].index
            : currentSelected
        if (activeIdx !== currentSelected) {
          onSelectDisplayRef.current(activeIdx)
        }
        if (list.length > 0) {
          refreshPreviews(list, activeIdx).catch(() => {})
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [refreshPreviews])

  const refreshWindows = useCallback(async () => {
    setLoadingWindows(true)
    try {
      const list = await listWindows()
      setWindows(list)
      return list
    } catch {
      return [] as WindowInfo[]
    } finally {
      setLoadingWindows(false)
    }
  }, [])

  const selectAppWindow = useCallback(
    (win: WindowInfo) => {
      onSelectWindow(win)
      if (win.displayIndex !== null) {
        onSelectDisplayRef.current(win.displayIndex)
      }
      captureWindowPreview(win.id)
        .then((dataUrl) => {
          setWindowPreviews((prev) => ({ ...prev, [win.id]: dataUrl }))
        })
        .catch(() => {})
    },
    [onSelectWindow]
  )

  const filteredWindows = useMemo(() => {
    const q = windowQuery.trim().toLowerCase()
    if (!q) return windows
    return windows.filter(
      (w) =>
        w.appName.toLowerCase().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        (w.displayName?.toLowerCase().includes(q) ?? false)
    )
  }, [windows, windowQuery])

  const activeDisplay = displays.find((d) => d.index === selectedDisplay)
  const activePreview =
    config.mode === "window" && selectedWindow
      ? windowPreviews[selectedWindow.id] ?? previews[selectedDisplay]
      : previews[selectedDisplay]
  const screenW = window.screen.width || 1920
  const screenH = window.screen.height || 1080

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (config.mode !== "region" || status !== "idle") return
    const box = previewBoxRef.current
    if (!box) return
    e.preventDefault()

    const rect = box.getBoundingClientRect()
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
    const startNx = clamp01((e.clientX - rect.left) / rect.width)
    const startNy = clamp01((e.clientY - rect.top) / rect.height)

    const updateFromCoords = (clientX: number, clientY: number) => {
      const curNx = clamp01((clientX - rect.left) / rect.width)
      const curNy = clamp01((clientY - rect.top) / rect.height)
      const left = Math.min(startNx, curNx)
      const top = Math.min(startNy, curNy)
      const width = Math.abs(curNx - startNx)
      const height = Math.abs(curNy - startNy)
      onRegionChange({
        x: Math.round(left * screenW),
        y: Math.round(top * screenH),
        width: Math.max(80, Math.round(width * screenW)),
        height: Math.max(80, Math.round(height * screenH)),
      })
    }

    const onMove = (ev: PointerEvent) => updateFromCoords(ev.clientX, ev.clientY)
    const onUp = (ev: PointerEvent) => {
      updateFromCoords(ev.clientX, ev.clientY)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-sidebar/50 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button
            variant={config.mode === "fullscreen" ? "default" : "secondary"}
            size="xs"
            disabled={status !== "idle"}
            onClick={() => onChange({ ...config, mode: "fullscreen" })}
            className="gap-1.5 rounded-sm"
          >
            <MonitorIcon className="size-3.5" />
            Fullscreen
          </Button>
          <Button
            variant={config.mode === "region" ? "default" : "secondary"}
            size="xs"
            disabled={status !== "idle"}
            onClick={() => onChange({ ...config, mode: "region" })}
            className="gap-1.5 rounded-sm"
          >
            <CropIcon className="size-3.5" />
            Region
          </Button>
          <Button
            variant={config.mode === "window" ? "default" : "secondary"}
            size="xs"
            disabled={status !== "idle"}
            onClick={() => {
              onChange({ ...config, mode: "window" })
              refreshWindows().then((list) => {
                if (list.length > 0 && !selectedWindow) {
                  selectAppWindow(list[0])
                } else if (selectedWindow) {
                  selectAppWindow(selectedWindow)
                }
              })
            }}
            className="gap-1.5 rounded-sm"
          >
            <AppWindowIcon className="size-3.5" />
            Window
          </Button>
          {config.mode === "window" && (
            <>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={windowQuery}
                  onChange={(e) => setWindowQuery(e.target.value)}
                  placeholder="Search apps or windows..."
                  className="h-6 w-48 rounded-sm border border-border bg-input pl-6.5 pr-2 text-xs text-foreground outline-none focus:border-ring"
                />
              </div>
              <Button
                variant="outline"
                size="xs"
                disabled={status !== "idle" || loadingWindows}
                onClick={() => refreshWindows()}
                className="gap-1.5 rounded-sm"
              >
                <RefreshCwIcon
                  className={`size-3 ${loadingWindows ? "animate-spin" : ""}`}
                />
                Refresh Apps
              </Button>
            </>
          )}
          {config.mode === "region" && (
            <>
              <Button
                variant="outline"
                size="xs"
                disabled={status !== "idle"}
                onClick={onOpenRegionSelector}
                className="rounded-sm"
              >
                Fullscreen Selector
              </Button>
              {region && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={status !== "idle"}
                  onClick={() => onRegionChange(null)}
                  className="rounded-sm text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Preview Stage */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3 overflow-hidden p-5">
        <div
          className="flex min-h-0 w-full flex-1 items-center justify-center"
          style={{ containerType: "size" }}
        >
          <div
            ref={previewBoxRef}
            onPointerDown={handleStagePointerDown}
            style={{
              width: "min(100cqw, calc(100cqh * 16 / 9))",
              height: "min(100cqh, calc(100cqw * 9 / 16))",
            }}
            className={`relative flex select-none items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-inner ${
              config.mode === "region" && status === "idle" ? "cursor-crosshair" : ""
            }`}
          >
          {activePreview ? (
            <img
              src={activePreview}
              alt={activeDisplay?.name ?? "Display Preview"}
              className="h-full w-full object-contain bg-black/40"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-primary">
                {previewError ? (
                  <ShieldAlertIcon className="size-6 text-destructive" />
                ) : (
                  <MonitorIcon className="size-6" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {previewError
                    ? "Screen Preview Unavailable"
                    : loadingPreview
                      ? "Capturing Display Preview..."
                      : "Ready to Capture Display"}
                </p>
                <p className="max-w-md text-xs text-muted-foreground">
                  {previewError ??
                    `${config.resolution} · ${config.fps} FPS · ${
                      config.micEnabled ? "Mic On" : "Mic Off"
                    }`}
                </p>
              </div>
              {previewError && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="xs"
                    className="rounded-sm"
                    onClick={() => openPrivacySettings("screen").catch(() => {})}
                  >
                    Grant Screen Permission
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    className="rounded-sm"
                    onClick={() => refreshPreviews(displays, selectedDisplay)}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Region Overlay Box on top of Preview */}
          {config.mode === "region" && region && (
            <div
              className="pointer-events-none absolute border-2 border-primary bg-primary/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{
                left: `${(region.x / screenW) * 100}%`,
                top: `${(region.y / screenH) * 100}%`,
                width: `${(region.width / screenW) * 100}%`,
                height: `${(region.height / screenH) * 100}%`,
              }}
            >
              <span className="absolute -top-6 left-0 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {Math.round(region.width)} × {Math.round(region.height)}
              </span>
            </div>
          )}

          {/* Non-blocking hint when Region mode has no region selected yet */}
          {activePreview && config.mode === "region" && !region && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="rounded-md border border-dashed border-primary/70 bg-background/85 px-4 py-2 text-center shadow-sm backdrop-blur">
                <p className="text-xs font-medium text-foreground">
                  Kéo chuột trực tiếp trên màn hình để chọn vùng quay
                </p>
              </div>
            </div>
          )}

          {/* Top-left Status & Display / Window Pill */}
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
            {config.mode === "window" && selectedWindow ? (
              <>
                <AppWindowIcon className="size-3 text-primary" />
                <span className="max-w-52 truncate">
                  {selectedWindow.appName}
                  {selectedWindow.title ? ` — ${selectedWindow.title}` : ""}
                </span>
                <span className="text-muted-foreground">
                  · {selectedWindow.width}×{selectedWindow.height}
                </span>
              </>
            ) : (
              <>
                <MonitorIcon className="size-3 text-primary" />
                <span>{activeDisplay?.name ?? "Display"}</span>
                {activeDisplay?.isPrimary && (
                  <span className="text-[10px] text-primary">(Primary)</span>
                )}
                <span className="text-muted-foreground">
                  · {config.resolution} · {config.fps} FPS
                </span>
              </>
            )}
          </div>

          {/* Bottom-left Active Overlay Badges */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
            {config.showMouseHighlight && (
              <Badge variant="secondary" className="gap-1 bg-background/85 text-[11px] backdrop-blur">
                <MousePointerClickIcon className="size-3 text-primary" />
                Mouse Highlight
              </Badge>
            )}
            {config.showKeystrokes && (
              <Badge variant="secondary" className="gap-1 bg-background/85 text-[11px] backdrop-blur">
                <KeyboardIcon className="size-3 text-primary" />
                Keystrokes
              </Badge>
            )}
            {config.cameraEnabled && (
              <Badge variant="secondary" className="gap-1 bg-background/85 text-[11px] backdrop-blur">
                <CameraIcon className="size-3 text-primary" />
                Camera PiP
              </Badge>
            )}
          </div>

          {config.watermarkEnabled && config.watermarkText && (
            <div
              className="pointer-events-none absolute bottom-3 right-4 text-xs font-medium text-foreground drop-shadow"
              style={{ opacity: config.watermarkOpacity }}
            >
              {config.watermarkText}
            </div>
          )}
          </div>
        </div>

        {/* Application Window Switcher Strip (Window mode) */}
        {config.mode === "window" && (
          <div className="flex w-full shrink-0 items-center gap-2.5 overflow-x-auto px-0.5 pt-1 pb-2.5">
            {filteredWindows.length === 0 ? (
              <p className="w-full text-center text-xs text-muted-foreground">
                {loadingWindows
                  ? "Scanning open application windows..."
                  : windows.length === 0
                    ? "No application windows found. Open an app and click Refresh Apps."
                    : "No windows match your search."}
              </p>
            ) : (
              filteredWindows.map((w) => {
                const selected = selectedWindow?.id === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={status !== "idle"}
                    onClick={() => selectAppWindow(w)}
                    className={`flex w-48 shrink-0 flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-all ${
                      selected
                        ? "border-primary bg-card ring-1 ring-primary"
                        : "border-border bg-card/60 hover:border-muted-foreground/50 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <AppWindowIcon className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate text-[11px] font-medium text-foreground">
                          {w.appName}
                        </span>
                      </div>
                      {displays.length > 1 && w.displayName && (
                        <span className="shrink-0 rounded-sm bg-secondary px-1 py-0.5 text-[9px] text-muted-foreground">
                          {w.displayName.replace("Capture screen ", "Display ")}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {w.title || `${w.width} × ${w.height}`}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* Multi-Monitor Switcher Strip */}
        {config.mode !== "window" && displays.length > 1 && (
          <div className="flex w-full shrink-0 items-center justify-center gap-2.5 overflow-x-auto px-0.5 pt-1 pb-2.5">
            {displays.map((d) => {
              const selected = d.index === selectedDisplay
              const thumb = previews[d.index]
              return (
                <button
                  key={d.index}
                  type="button"
                  disabled={status !== "idle"}
                  onClick={() => onSelectDisplay(d.index)}
                  className={`group flex w-40 shrink-0 flex-col overflow-hidden rounded-md border text-left transition-all ${
                    selected
                      ? "border-primary bg-card ring-1 ring-primary"
                      : "border-border bg-card/60 hover:border-muted-foreground/50 hover:bg-card"
                  }`}
                >
                  <div className="relative aspect-video w-full bg-secondary">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={d.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <MonitorIcon className="size-4" />
                      </div>
                    )}
                    {d.isPrimary && (
                      <span className="absolute right-1 top-1 rounded-sm bg-background/85 px-1 py-0.5 text-[9px] font-medium text-primary">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="truncate px-2 py-1 text-[11px] font-medium text-foreground">
                    {d.name}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
