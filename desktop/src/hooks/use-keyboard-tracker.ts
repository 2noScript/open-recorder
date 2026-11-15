import { useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"

export interface KeyEvent {
  key: string
  id: number
}

interface GlobalKeystrokePayload {
  key: string
  timestamp: number
}

export function useKeyboardTracker() {
  const [events, setEvents] = useState<KeyEvent[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const timers = timersRef.current
    let active = true
    let unlisten: (() => void) | null = null

    listen<GlobalKeystrokePayload>("global-keystroke", (event) => {
      if (!active) return
      const id = ++idRef.current
      const label = event.payload.key
      setEvents((prev) => [...prev.slice(-5), { key: label, id }])
      const timer = setTimeout(() => {
        setEvents((prev) => prev.filter((k) => k.id !== id))
      }, 2000)
      timers.push(timer)
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

  return { events }
}
