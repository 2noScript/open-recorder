import type { CursorState } from "@/hooks/use-cursor-tracker"

interface MouseHighlighterProps {
  cursor: CursorState
}

export function MouseHighlighter({ cursor }: MouseHighlighterProps) {
  const clickVisible = cursor.click !== null

  if (!clickVisible && cursor.position.x === 0 && cursor.position.y === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-400 bg-red-500/30"
        style={{ left: cursor.position.x, top: cursor.position.y }}
      />
      {clickVisible && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-yellow-400"
          style={{
            left: cursor.click!.x,
            top: cursor.click!.y,
            width: 4,
            height: 4,
          }}
        />
      )}
    </div>
  )
}
