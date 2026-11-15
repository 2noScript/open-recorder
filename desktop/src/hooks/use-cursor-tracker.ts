import { useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"

export interface CursorState {
  position: { x: number; y: number }
  click: { x: number; y: number; time: number } | null
}

interface GlobalCursorPayload {
  x: number
  y: number
  eventType: "move" | "down" | "up"
  button: string | null
}

export function useCursorTracker() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [click, setClick] = useState<{ x: number; y: number; time: number } | null>(null)
  const clickTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const timers = clickTimersRef.current
    let active = true
    let unlisten: (() => void) | null = null

    listen<GlobalCursorPayload>("global-cursor", (event) => {
      if (!active) return
      const { x, y, eventType } = event.payload
      if (eventType === "move") {
        setPosition({ x, y })
      } else if (eventType === "down") {
        setClick({ x, y, time: Date.now() })
        const timer = setTimeout(() => {
          setClick(null)
        }, 400)
        timers.push(timer)
      }
    }).then((fn) => {
      if (active) {
        unlisten = fn
      } else {
        fn()
      }
    })

    return () => {
      active = false
      timers.forEach(clearTimeout)
      unlisten?.()
    }
  }, [])

  return { position, click } satisfies CursorState
}
