import { useEffect, useRef, useState } from "react"

export interface CursorState {
  position: { x: number; y: number }
  click: { x: number; y: number; time: number } | null
}

export function useCursorTracker() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [click, setClick] = useState<{ x: number; y: number; time: number } | null>(null)
  const clickTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const timers = clickTimersRef.current

    function onMove(e: MouseEvent) {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    function onDown(e: MouseEvent) {
      const entry = { x: e.clientX, y: e.clientY, time: Date.now() }
      setClick(entry)
      const timer = setTimeout(() => {
        setClick(null)
      }, 400)
      timers.push(timer)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mousedown", onDown)

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mousedown", onDown)
    }
  }, [])

  return { position, click } satisfies CursorState
}
