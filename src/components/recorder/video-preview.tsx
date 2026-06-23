import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DownloadIcon, RotateCcwIcon } from "lucide-react"

interface VideoPreviewProps {
  blob: Blob
  elapsed: number
  mimeType: string
  onReset: () => void
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function VideoPreview({ blob, elapsed, mimeType, onReset }: VideoPreviewProps) {
  const videoUrl = useMemo(() => URL.createObjectURL(blob), [blob])

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  function handleDownload() {
    const ext = mimeType.includes("mp4") ? "mp4" : "webm"
    const link = document.createElement("a")
    link.href = videoUrl
    link.download = `recording-${Date.now()}.${ext}`
    link.click()
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recording Preview</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatDuration(elapsed)}</Badge>
            <Badge variant="outline">{formatSize(blob.size)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <video
          src={videoUrl}
          controls
          className="w-full rounded-b-none"
        />
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcwIcon className="size-4" />
          Record Again
        </Button>
        <Button onClick={handleDownload} className="gap-2">
          <DownloadIcon className="size-4" />
          Download
        </Button>
      </CardFooter>
    </Card>
  )
}
