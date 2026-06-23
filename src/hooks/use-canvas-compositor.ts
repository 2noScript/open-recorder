import { useCallback, useRef } from "react"
import type { Region } from "@/hooks/use-region"
import type { Stroke } from "@/hooks/use-annotation-strokes"
import { renderStrokes } from "@/hooks/use-annotation-strokes"

export interface CompositorOptions {
  cameraStream: MediaStream | null
  watermark: { text: string; color: string; opacity: number } | null
}

export function useCanvasCompositor() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef(0)
  const runningRef = useRef(false)
  const optionsRef = useRef<CompositorOptions>({
    cameraStream: null,
    watermark: null,
  })
  const strokesRef = useRef<Stroke[]>([])

  const updateOptions = useCallback((opts: Partial<CompositorOptions>) => {
    optionsRef.current = { ...optionsRef.current, ...opts }
    if (opts.cameraStream && !cameraVideoRef.current?.srcObject) {
      const cv = document.createElement("video")
      cv.srcObject = opts.cameraStream
      cv.muted = true
      cv.playsInline = true
      cv.play()
      cameraVideoRef.current = cv
    }
    if (opts.cameraStream === null && cameraVideoRef.current) {
      cameraVideoRef.current.pause()
      cameraVideoRef.current.srcObject = null
      cameraVideoRef.current = null
    }
  }, [])

  const updateStrokes = useCallback((strokes: Stroke[]) => {
    strokesRef.current = strokes
  }, [])

  const startCapture = useCallback(
    (
      displayStream: MediaStream,
      region: Region | null,
      targetWidth: number,
      targetHeight: number,
      fps: number
    ) => {
      const video = document.createElement("video")
      video.srcObject = displayStream
      video.muted = true
      video.playsInline = true
      video.play()
      videoRef.current = video

      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext("2d")!
      runningRef.current = true
      let lastFrame = 0
      const frameInterval = 1000 / fps

      function render(now: number) {
        if (!runningRef.current) return
        const elapsed = now - lastFrame

        if (elapsed >= frameInterval) {
          lastFrame = now - (elapsed % frameInterval)
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (video.readyState >= 2) {
            if (region) {
              ctx.drawImage(
                video,
                region.x,
                region.y,
                region.width,
                region.height,
                0,
                0,
                canvas.width,
                canvas.height
              )
            } else {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            }
          }

          drawCamera(ctx, canvas, cameraVideoRef.current, "bottom-right")

          const wm = optionsRef.current.watermark
          if (wm) {
            ctx.save()
            ctx.globalAlpha = wm.opacity
            ctx.font = "14px sans-serif"
            ctx.fillStyle = wm.color
            ctx.textBaseline = "top"
            ctx.fillText(wm.text, 12, 12)
            ctx.restore()
          }

          const strokes = strokesRef.current
          if (strokes.length > 0) {
            renderStrokes(ctx, strokes)
          }
        }

        rafRef.current = requestAnimationFrame(render)
      }

      rafRef.current = requestAnimationFrame(render)
      const canvasStream = canvas.captureStream(fps)

      return {
        stream: canvasStream,
        canvas,
        stop: () => {
          runningRef.current = false
          cancelAnimationFrame(rafRef.current)
          video.pause()
          video.srcObject = null
          cameraVideoRef.current?.pause()
          if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
          displayStream.getTracks().forEach((t) => t.stop())
        },
      }
    },
    []
  )

  return { startCapture, updateOptions, updateStrokes }
}

function drawCamera(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cameraVideo: HTMLVideoElement | null,
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
) {
  if (!cameraVideo || cameraVideo.readyState < 2) return

  const pipW = canvas.width * 0.22
  const pipH = pipW * (cameraVideo.videoHeight / cameraVideo.videoWidth)
  const margin = 16

  let x: number, y: number
  switch (position) {
    case "top-left":
      x = margin
      y = margin
      break
    case "top-right":
      x = canvas.width - pipW - margin
      y = margin
      break
    case "bottom-left":
      x = margin
      y = canvas.height - pipH - margin
      break
    case "bottom-right":
      x = canvas.width - pipW - margin
      y = canvas.height - pipH - margin
      break
  }

  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.3)"
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.roundRect(x, y, pipW, pipH, 8)
  ctx.clip()
  ctx.drawImage(cameraVideo, x, y, pipW, pipH)
  ctx.restore()
  ctx.strokeStyle = "rgba(255,255,255,0.5)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, pipW, pipH, 8)
  ctx.stroke()
}
