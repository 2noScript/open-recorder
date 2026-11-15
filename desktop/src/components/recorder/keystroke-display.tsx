import { useMemo } from "react"

interface KeystrokeDisplayProps {
  events: Array<{ key: string; id: number }>
}

export function KeystrokeDisplay({ events }: KeystrokeDisplayProps) {
  const unique = useMemo(
    () => [...new Set(events.slice(-5).map((e) => e.key))],
    [events]
  )

  if (unique.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-lg bg-black/50 px-3 py-2 font-mono text-sm text-white/85 shadow-lg">
      {unique.join(" + ")}
    </div>
  )
}
