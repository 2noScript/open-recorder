import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Trash2Icon,
  DownloadIcon,
  FilePenLineIcon,
  VideoIcon,
} from "lucide-react"
import type { Recording } from "@/lib/db"

interface HistoryItemProps {
  recording: Recording
  onDelete: (id: number) => void
  onRename: (id: number, name: string) => void
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function HistoryItem({ recording, onDelete, onRename }: HistoryItemProps) {
  const thumbnailUrl = useMemo(() => {
    if (recording.thumbnail) return URL.createObjectURL(recording.thumbnail)
    return null
  }, [recording.thumbnail])

  function handleDownload() {
    const ext = recording.mimeType.includes("mp4") ? "mp4" : "webm"
    const link = document.createElement("a")
    link.href = URL.createObjectURL(recording.blob)
    link.download = `${recording.name}.${ext}`
    link.click()
  }

  return (
    <Card size="sm">
      <CardContent className="flex gap-3 p-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <VideoIcon className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {recording.name}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                const name = prompt("New name:", recording.name)
                if (name && name !== recording.name) {
                  onRename(recording.id!, name)
                }
              }}
            >
              <FilePenLineIcon className="size-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDuration(recording.duration)}</span>
            <span>·</span>
            <span>{formatSize(recording.size)}</span>
            <span>·</span>
            <span>{formatDate(recording.createdAt)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-1 px-3 py-2">
        <Button variant="ghost" size="xs" onClick={handleDownload}>
          <DownloadIcon className="size-3" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onDelete(recording.id!)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2Icon className="size-3" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
