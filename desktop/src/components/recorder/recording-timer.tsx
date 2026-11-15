import { Badge } from "@/components/ui/badge"

interface RecordingTimerProps {
  elapsed: number
  fileSize?: number
  isPaused?: boolean
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function RecordingTimer({ elapsed, fileSize, isPaused }: RecordingTimerProps) {
  return (
    <div className="flex items-center gap-2">
      {!isPaused && (
        <span className="inline-flex size-2.5 rounded-full bg-red-500">
          <span className="inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
        </span>
      )}
      <Badge
        variant={isPaused ? "outline" : "destructive"}
        className="font-mono text-sm tabular-nums"
      >
        {isPaused ? "PAUSED" : "REC"} {formatTime(elapsed)}
      </Badge>
      {fileSize !== undefined && fileSize > 0 && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatSize(fileSize)}
        </span>
      )}
    </div>
  )
}
