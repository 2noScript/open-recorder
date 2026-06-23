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
  region: Region
  onPointerDown: (e: React.PointerEvent, handle: string) => void
  screenWidth: number
  screenHeight: number
}

export function RegionSelector({
  region,
  onPointerDown,
  screenWidth,
  screenHeight,
}: RegionSelectorProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90]"
      style={{
        cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='28'%3E%3Cpath d='M2 2 L2 22 L8 16 L12 24 L14 22 L10 14 L20 14 Z' fill='white' stroke='black' stroke-width='1'/%3E%3C/svg%3E") 2 2, crosshair`,
      }}
    >
      <svg
        className="pointer-events-auto absolute inset-0 size-full"
        style={{ cursor: "inherit" }}
      >
        <defs>
          <mask id="region-mask">
            <rect width={screenWidth} height={screenHeight} fill="white" />
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width={screenWidth}
          height={screenHeight}
          fill="rgba(0,0,0,0.45)"
          mask="url(#region-mask)"
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

        {HANDLES.map((handle) => {
          const pos = getHandlePos(handle, region)
          const isCorner = handle.includes("-")
          return (
            <div
              key={handle}
              className="absolute z-10 border-2 border-white bg-black/50"
              style={{
                cursor: HANDLE_CURSOR[handle],
                width: isCorner ? 14 : 14,
                height: isCorner ? 14 : 14,
                left: pos.x - (isCorner ? 7 : 7),
                top: pos.y - (isCorner ? 7 : 7),
                borderRadius: isCorner ? "50%" : 0,
              }}
              onPointerDown={(e) => onPointerDown(e, handle)}
            />
          )
        })}
      </div>
    </div>
  )
}

function getHandlePos(handle: string, r: Region) {
  switch (handle) {
    case "top-left":
      return { x: r.x, y: r.y }
    case "top":
      return { x: r.x + r.width / 2, y: r.y }
    case "top-right":
      return { x: r.x + r.width, y: r.y }
    case "right":
      return { x: r.x + r.width, y: r.y + r.height / 2 }
    case "bottom-right":
      return { x: r.x + r.width, y: r.y + r.height }
    case "bottom":
      return { x: r.x + r.width / 2, y: r.y + r.height }
    case "bottom-left":
      return { x: r.x, y: r.y + r.height }
    case "left":
      return { x: r.x, y: r.y + r.height / 2 }
    default:
      return { x: 0, y: 0 }
  }
}
