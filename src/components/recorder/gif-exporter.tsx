import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { FileImageIcon, Loader2Icon } from "lucide-react"

interface GifExporterProps {
  videoBlob: Blob
  duration: number
  onClose: () => void
}

export function GifExporter({ videoBlob, duration, onClose }: GifExporterProps) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(Math.min(duration / 1000, 5))
  const [gifFps, setGifFps] = useState(10)
  const [exporting, setExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoUrl] = useState(() => URL.createObjectURL(videoBlob))

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl)
  }, [videoUrl])



  const handleExport = useCallback(async () => {
    setExporting(true)
    if (!videoUrl) return

    const video = document.createElement("video")
    video.src = videoUrl
    video.muted = true
    video.playsInline = true
    await video.play()

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")!

    const GIF = (await import("gif.js")).default
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: video.videoWidth,
      height: video.videoHeight,
      workerScript: "/gif.worker.js",
    })

    const frameInterval = 1 / gifFps
    let currentTime = start

    await new Promise<void>((resolve) => {
      function capture() {
        if (currentTime >= end) {
          gif.on("finished", (blob: Blob) => {
            const url = URL.createObjectURL(blob)
            setPreviewUrl(url)
            setExporting(false)
            resolve()
          })
          gif.render()
          return
        }
        video.currentTime = currentTime
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0)
          gif.addFrame(ctx, { copy: true, delay: 1000 / gifFps })
          currentTime += frameInterval
          capture()
        }
      }
      capture()
    })
  }, [start, end, gifFps, videoUrl])

  function handleDownload() {
    if (!previewUrl) return
    const link = document.createElement("a")
    link.href = previewUrl
    link.download = `recording-${Date.now()}.gif`
    link.click()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Export GIF</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Start: {start.toFixed(1)}s</Label>
          <Slider
            value={[start]}
            onValueChange={([v]) => setStart(Math.min(v, end - 0.5))}
            max={duration / 1000}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Label>End: {end.toFixed(1)}s</Label>
          <Slider
            value={[end]}
            onValueChange={([v]) => setEnd(Math.max(v, start + 0.5))}
            max={duration / 1000}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Label>FPS: {gifFps}</Label>
          <Slider
            value={[gifFps]}
            onValueChange={([v]) => setGifFps(Math.round(v))}
            min={5}
            max={30}
            step={1}
          />
        </div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="GIF preview"
            className="w-full rounded-lg"
          />
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {previewUrl ? (
          <Button onClick={handleDownload} className="gap-2">
            <FileImageIcon className="size-4" />
            Download GIF
          </Button>
        ) : (
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting && <Loader2Icon className="size-4 animate-spin" />}
            {exporting ? "Exporting..." : "Export GIF"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
