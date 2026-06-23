import { useCallback, useEffect, useRef, useState } from "react"

export type RecorderStatus = "idle" | "recording" | "paused" | "done"

export interface RecordingConfig {
  resolution: "720p" | "1080p" | "4K" | "original"
  fps: 15 | 30 | 60
  micEnabled: boolean
  micDeviceId: string
  systemAudio: boolean

  mode: "fullscreen" | "region"
  countdown: number
  showMouseHighlight: boolean
  showKeystrokes: boolean
  cameraEnabled: boolean
  cameraDeviceId: string
  watermarkEnabled: boolean
  watermarkText: string
  watermarkOpacity: number
  annotationsEnabled: boolean
}

export const RESOLUTION_PRESETS: Record<
  string,
  { width: number; height: number } | null
> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4K": { width: 3840, height: 2160 },
  original: null,
}

export const DEFAULT_CONFIG: RecordingConfig = {
  resolution: "1080p",
  fps: 30,
  micEnabled: false,
  micDeviceId: "",
  systemAudio: true,

  mode: "fullscreen",
  countdown: 0,
  showMouseHighlight: false,
  showKeystrokes: false,
  cameraEnabled: false,
  cameraDeviceId: "",
  watermarkEnabled: false,
  watermarkText: "Open Recorder",
  watermarkOpacity: 0.3,
  annotationsEnabled: false,
}

const SUPPORTED_MIME_TYPE = getSupportedMimeType()

export function useScreenRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle")
  const [blob, setBlob] = useState<Blob | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [fileSize, setFileSize] = useState(0)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const displayStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const pausedDurationRef = useRef(0)
  const isStoppedRef = useRef(false)
  const accumulatedSizeRef = useRef(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const systemGainRef = useRef<GainNode | null>(null)
  const micGainRef = useRef<GainNode | null>(null)
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(pausedDurationRef.current + (Date.now() - startTimeRef.current))
    }, 100)
  }, [])

  const cleanupAudio = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close()
    }
    audioCtxRef.current = null
    systemGainRef.current = null
    micGainRef.current = null
    destRef.current = null
  }, [])

  const cleanupStreams = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    displayStreamRef.current = null
    micStreamRef.current = null
    setMicStream(null)
  }, [])

  const cleanup = useCallback(() => {
    cleanupStreams()
    cleanupAudio()
  }, [cleanupStreams, cleanupAudio])

  const setSystemVolume = useCallback((volume: number) => {
    if (systemGainRef.current) {
      systemGainRef.current.gain.setValueAtTime(volume, audioCtxRef.current!.currentTime)
    }
  }, [])

  const setMicVolume = useCallback((volume: number) => {
    if (micGainRef.current) {
      micGainRef.current.gain.setValueAtTime(volume, audioCtxRef.current!.currentTime)
    }
  }, [])

  const stop = useCallback(() => {
    if (isStoppedRef.current) return
    if (
      recorderRef.current?.state === "recording" ||
      recorderRef.current?.state === "paused"
    ) {
      isStoppedRef.current = true
      recorderRef.current.stop()
      return
    }
    isStoppedRef.current = true
    cleanup()
    clearTimer()
    setStatus("idle")
  }, [cleanup, clearTimer])

  const stopRef = useRef(stop)

  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  const start = useCallback(
    async (stream: MediaStream, config: RecordingConfig) => {
      try {
        isStoppedRef.current = false
        accumulatedSizeRef.current = 0
        setFileSize(0)

        displayStreamRef.current = stream
        const videoTrack = stream.getVideoTracks()[0]
        if (!videoTrack) throw new Error("No video track")

        videoTrack.addEventListener("ended", () => stopRef.current())

        let mic: MediaStream | null = null
        if (config.micEnabled) {
          try {
            const micConstraints: MediaStreamConstraints = {
              audio: config.micDeviceId
                ? {
                    deviceId: { exact: config.micDeviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                  }
                : { echoCancellation: true, noiseSuppression: true },
            }
            mic = await navigator.mediaDevices.getUserMedia(micConstraints)
            micStreamRef.current = mic
            setMicStream(mic)
          } catch {
            micStreamRef.current = null
            setMicStream(null)
          }
        }

        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const dest = ctx.createMediaStreamDestination()
        destRef.current = dest

        const audioTracks: MediaStreamTrack[] = []

        for (const track of stream.getAudioTracks()) {
          audioTracks.push(track)
          const source = ctx.createMediaStreamSource(new MediaStream([track]))
          const gain = ctx.createGain()
          gain.gain.value = 1.0
          systemGainRef.current = gain
          source.connect(gain).connect(dest)
        }

        if (mic) {
          for (const track of mic.getAudioTracks()) {
            audioTracks.push(track)
            const source = ctx.createMediaStreamSource(new MediaStream([track]))
            const gain = ctx.createGain()
            gain.gain.value = 1.0
            micGainRef.current = gain
            source.connect(gain).connect(dest)
          }
        }

        const combinedStream = new MediaStream([videoTrack, ...dest.stream.getAudioTracks()])

        const mimeType = SUPPORTED_MIME_TYPE
        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 5_000_000,
        })
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data)
            accumulatedSizeRef.current += e.data.size
            setFileSize(accumulatedSizeRef.current)
          }
        }

        recorder.onstop = () => {
          cleanup()
          clearTimer()
          cleanupAudio()
          const finalBlob = new Blob(chunksRef.current, { type: mimeType })
          setBlob(finalBlob)
          setStatus("done")
        }

        recorder.start(100)
        pausedDurationRef.current = 0
        startTimer()
        setStatus("recording")
      } catch {
        cleanup()
        clearTimer()
        setMicStream(null)
        setStatus("idle")
      }
    },
    [cleanup, clearTimer, startTimer, cleanupAudio]
  )

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause()
      clearTimer()
      pausedDurationRef.current += Date.now() - startTimeRef.current
      setStatus("paused")
    }
  }, [clearTimer])

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume()
      startTimer()
      setStatus("recording")
    }
  }, [startTimer])

  const reset = useCallback(() => {
    clearTimer()
    cleanup()
    isStoppedRef.current = false
    recorderRef.current = null
    chunksRef.current = []
    pausedDurationRef.current = 0
    accumulatedSizeRef.current = 0
    setBlob(null)
    setElapsed(0)
    setFileSize(0)
    setMicStream(null)
    setStatus("idle")
  }, [clearTimer, cleanup])

  return {
    status,
    blob,
    elapsed,
    fileSize,
    micStream,
    mimeType: SUPPORTED_MIME_TYPE,
    start,
    pause,
    resume,
    stop,
    reset,
    setSystemVolume,
    setMicVolume,
  }
}

function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return "video/webm"
}
