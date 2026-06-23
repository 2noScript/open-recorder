import { useEffect, useState } from "react"

interface CountdownOverlayProps {
  seconds: number
  onDone: () => void
}

export function CountdownOverlay({ seconds, onDone }: CountdownOverlayProps) {
  const [count, setCount] = useState(seconds)

  useEffect(() => {
    if (count <= 0) {
      onDone()
      return
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [count, onDone])

  if (count <= 0) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <span className="animate-in zoom-in-150 text-9xl font-bold text-white drop-shadow-2xl">
        {count}
      </span>
    </div>
  )
}
