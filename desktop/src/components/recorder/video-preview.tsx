import { useMemo } from "react"
import { save } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DownloadIcon, FolderOpenIcon, RotateCcwIcon } from "lucide-react"
import {
  type Recording,
  exportRecordingFile,
  getMediaUrl,
  openRecordingInFolder,
} from "@/lib/db"

interface VideoPreviewProps {
  recording: Recording
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

export function VideoPreview({ recording, onReset }: VideoPreviewProps) {
  const videoUrl = useMemo(
    () => getMediaUrl(recording.filePath),
    [recording.filePath]
  )

  async function handleExport() {
    const ext = recording.mimeType.includes("mp4") ? "mp4" : "webm"
    const destPath = await save({
      defaultPath: `${recording.name}.${ext}`,
      filters: [{ name: "Video", extensions: [ext] }],
    })
    if (destPath) {
      await exportRecordingFile(recording.filePath, destPath)
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recording Preview</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatDuration(recording.duration)}</Badge>
            <Badge variant="outline">{formatSize(recording.size)}</Badge>
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
      <CardFooter className="justify-between gap-2">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcwIcon className="size-4" />
          Record Again
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openRecordingInFolder(recording.filePath)}
            className="gap-2"
          >
            <FolderOpenIcon className="size-4" />
            Show in Folder
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <DownloadIcon className="size-4" />
            Export
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
