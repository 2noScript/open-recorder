import { useEffect, useRef, useState } from "react"

const KEY_LABEL: Record<string, string> = {
  " ": "Space",
  Backspace: "⌫",
  Enter: "↵",
  Tab: "⇥",
  Shift: "⇧",
  Control: "Ctrl",
  Alt: "Alt",
  Meta: "⌘",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Delete: "Del",
}

export interface KeyEvent {
  key: string
  id: number
}

export function useKeyboardTracker() {
  const [events, setEvents] = useState<KeyEvent[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const timers = timersRef.current

    function onDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) return
      const id = ++idRef.current
      const label = KEY_LABEL[e.key] ?? e.key
      setEvents((prev) => [...prev.slice(-5), { key: label, id }])
      const timer = setTimeout(() => {
        setEvents((prev) => prev.filter((k) => k.id !== id))
      }, 2000)
      timers.push(timer)
    }

    window.addEventListener("keydown", onDown)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener("keydown", onDown)
    }
  }, [])

  return { events }
}
