import { useCallback, useRef, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2Icon } from "lucide-react"

interface VideoTrimmerProps {
  videoBlob: Blob
  mimeType: string
  duration: number
  onDone: (trimmedBlob: Blob) => void
  onClose: () => void
}

export function VideoTrimmer({
  videoBlob,
  mimeType,
  duration,
  onDone,
  onClose,
}: VideoTrimmerProps) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(duration / 1000)
  const [exporting, setExporting] = useState(false)
  const [quality, setQuality] = useState("medium")
  const videoUrlRef = useRef(URL.createObjectURL(videoBlob))

  const handleTrim = useCallback(async () => {
    setExporting(true)
    const video = document.createElement("video")
    video.src = videoUrlRef.current
    video.muted = true
    video.playsInline = true
    await video.play()

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")!

    const stream = canvas.captureStream(30)
    const bitsPerSecond =
      quality === "low" ? 1_000_000 : quality === "high" ? 10_000_000 : 5_000_000

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp9"
      )
        ? "video/webm;codecs=vp9"
        : "video/webm",
      videoBitsPerSecond: bitsPerSecond,
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      const trimmedBlob = new Blob(chunks, { type: mimeType })
      URL.revokeObjectURL(videoUrlRef.current)
      onDone(trimmedBlob)
      setExporting(false)
    }

    recorder.start(100)

    let currentTime = start
    const frameInterval = 1 / 30
    const endTime = end

    function capture() {
      if (currentTime >= endTime) {
        recorder.stop()
        video.pause()
        return
      }
      video.currentTime = currentTime
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0)
        currentTime += frameInterval
        requestAnimationFrame(capture)
      }
    }

    capture()
  }, [start, end, quality, mimeType, onDone])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Trim Video</CardTitle>
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
        <div className="flex items-center justify-between">
          <Label>Quality</Label>
          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Duration: {Math.max(0, end - start).toFixed(1)}s
        </p>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleTrim}
          disabled={exporting}
          className="gap-2"
        >
          {exporting && <Loader2Icon className="size-4 animate-spin" />}
          {exporting ? "Trimming..." : "Trim & Save"}
        </Button>
      </CardFooter>
    </Card>
  )
}
