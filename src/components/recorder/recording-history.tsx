import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HistoryItem } from "@/components/recorder/history-item"
import { RotateCwIcon, HistoryIcon, MonitorIcon } from "lucide-react"
import type { useRecordingStorage } from "@/hooks/use-recording-storage"

interface RecordingHistoryProps {
  storage: ReturnType<typeof useRecordingStorage>
  onBack: () => void
}

export function RecordingHistory({ storage, onBack }: RecordingHistoryProps) {
  const { recordings, loading, refresh, remove, rename } = storage

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recording History</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RotateCwIcon className="size-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            <MonitorIcon className="size-4" />
            New Recording
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-sm text-muted-foreground">Loading...</p>
      )}

      {!loading && recordings.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <HistoryIcon className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No recordings yet</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            <MonitorIcon className="size-4" />
            Record your first video
          </Button>
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          {recordings.map((rec) => (
            <HistoryItem
              key={rec.id}
              recording={rec}
              onDelete={remove}
              onRename={rename}
            />
          ))}
        </div>
      )}
    </div>
  )
}
