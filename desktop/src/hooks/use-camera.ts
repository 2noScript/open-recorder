import { useCallback, useEffect, useRef, useState } from "react"

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async (deviceId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 320 }, height: { ideal: 240 } }
          : { width: { ideal: 320 }, height: { ideal: 240 } },
      }
      const s = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = s
      setStream(s)
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera permission denied"
        : "Could not access camera"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
    setError(null)
  }, [])

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      setDevices(all.filter((d) => d.kind === "videoinput"))
    })
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { stream, loading, error, devices, start, stop }
}
