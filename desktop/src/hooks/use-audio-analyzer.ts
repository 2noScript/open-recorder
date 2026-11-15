import { useCallback, useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"

export function useAudioAnalyzer() {
  const [volume, setVolume] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const unlistenRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    unlistenRef.current?.()
    unlistenRef.current = null
    setIsActive(false)
    setVolume(0)
  }, [])

  const start = useCallback(async () => {
    stop()
    setIsActive(true)
    const unlisten = await listen<number>("audio-level", (event) => {
      setVolume(event.payload)
    })
    unlistenRef.current = unlisten
  }, [stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { volume, isActive, start, stop }
}
