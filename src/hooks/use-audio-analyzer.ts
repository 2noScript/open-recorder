import { useCallback, useEffect, useRef, useState } from "react"

export function useAudioAnalyzer() {
  const [volume, setVolume] = useState(0)
  const [isActive, setIsActive] = useState(false)

  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef(0)

  const start = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyzer = audioCtx.createAnalyser()
      analyzer.fftSize = 256
      source.connect(analyzer)

      contextRef.current = audioCtx
      sourceRef.current = source
      analyzerRef.current = analyzer
      setIsActive(true)

      const dataArray = new Uint8Array(analyzer.frequencyBinCount)

      function poll() {
        analyzer.getByteFrequencyData(dataArray)
        const sum = dataArray.reduce((a, b) => a + b, 0)
        setVolume(sum / dataArray.length / 255)
        rafRef.current = requestAnimationFrame(poll)
      }

      poll()
    } catch {
      setIsActive(false)
    }
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    contextRef.current?.close()
    contextRef.current = null
    sourceRef.current = null
    analyzerRef.current = null
    rafRef.current = 0
    setIsActive(false)
    setVolume(0)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { volume, isActive, start, stop }
}
