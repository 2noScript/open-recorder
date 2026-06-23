import type { Region } from "@/hooks/use-region"

const HANDLES = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
] as const

const HANDLE_CURSOR: Record<string, string> = {
  "top-left": "nwse-resize",
  top: "ns-resize",
  "top-right": "nesw-resize",
  right: "ew-resize",
  "bottom-right": "nwse-resize",
  bottom: "ns-resize",
  "bottom-left": "nesw-resize",
  left: "ew-resize",
}

interface RegionSelectorProps {
  region: Region | null
  onPointerDown: (e: React.PointerEvent, handle: string) => void
  onCreate: (e: React.PointerEvent) => void
  onReset: () => void
  screenWidth: number
  screenHeight: number
}

function Handle({ handle, region, onPointerDown }: { handle: string; region: Region; onPointerDown: (e: React.PointerEvent, handle: string) => void }) {
  const pos = getHandlePos(handle, region)
  const isCorner = handle.includes("-")
  const size = 14
  return (
    <div
      className="absolute z-10"
      style={{
        cursor: HANDLE_CURSOR[handle],
        width: size,
        height: size,
        left: pos.x - size / 2,
        top: pos.y - size / 2,
        borderRadius: isCorner ? "50%" : 0,
        backgroundColor: isCorner ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.5)",
        boxShadow: "0 0 0 2px white",
      }}
      onPointerDown={(e) => onPointerDown(e, handle)}
    />
  )
}

export function RegionSelector({ region, onPointerDown, onCreate, onReset, screenWidth, screenHeight }: RegionSelectorProps) {
  if (!region) {
    return (
      <div
        className="fixed inset-0 z-[90] flex cursor-crosshair items-center justify-center bg-black/30"
        onPointerDown={onCreate}
      >
        <div className="pointer-events-none rounded-xl border border-dashed border-white/40 bg-black/30 px-8 py-4 text-center backdrop-blur-sm">
          <p className="text-lg font-medium text-white">Click & drag to select a region</p>
          <p className="mt-1 text-sm text-white/60">or switch to Fullscreen mode</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <svg className="absolute inset-0 size-full">
        <defs>
          <mask id="region-mask">
            <rect width={screenWidth} height={screenHeight} fill="white" />
            <rect x={region.x} y={region.y} width={region.width} height={region.height} fill="black" />
          </mask>
        </defs>
        <rect
          width={screenWidth}
          height={screenHeight}
          fill="rgba(0,0,0,0.45)"
          mask="url(#region-mask)"
          pointerEvents="none"
        />
      </svg>

      <div
        className="pointer-events-auto absolute"
        style={{
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
        }}
      >
        <div
          className="flex size-full cursor-move items-center justify-center"
          onPointerDown={(e) => onPointerDown(e, "move")}
        >
          <div className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
            {Math.round(region.width)} × {Math.round(region.height)}
          </div>
        </div>

        {HANDLES.map((handle) => (
          <Handle key={handle} handle={handle} region={region} onPointerDown={onPointerDown} />
        ))}

        <button
          type="button"
          className="pointer-events-auto absolute -right-2 -top-2 z-20 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground shadow hover:bg-destructive/90"
          onClick={onReset}
          title="Clear region"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function getHandlePos(handle: string, r: Region) {
  switch (handle) {
    case "top-left":
      return { x: 0, y: 0 }
    case "top":
      return { x: r.width / 2, y: 0 }
    case "top-right":
      return { x: r.width, y: 0 }
    case "right":
      return { x: r.width, y: r.height / 2 }
    case "bottom-right":
      return { x: r.width, y: r.height }
    case "bottom":
      return { x: r.width / 2, y: r.height }
    case "bottom-left":
      return { x: 0, y: r.height }
    case "left":
      return { x: 0, y: r.height / 2 }
    default:
      return { x: 0, y: 0 }
  }
}
