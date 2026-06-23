import { useEffect, useRef } from "react"

interface CameraOverlayProps {
  stream: MediaStream | null
  loading: boolean
  error: string | null
}

export function CameraOverlay({ stream, loading, error }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (!stream && !loading && !error) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/30">
      {loading && (
        <div className="flex h-24 w-32 items-center justify-center bg-black/30 text-xs text-white/60">
          Loading camera...
        </div>
      )}
      {error && (
        <div className="flex h-24 w-32 items-center justify-center bg-black/30 p-2 text-center text-xs text-red-300">
          {error}
        </div>
      )}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-36 w-48 object-cover"
        />
      )}
    </div>
  )
}
