import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { HistoryItem } from "@/components/recorder/history-item"
import { VideoPreview } from "@/components/recorder/video-preview"
import { HistoryIcon, MonitorIcon, SearchIcon } from "lucide-react"
import type { useRecordingStorage } from "@/hooks/use-recording-storage"
import type { Recording } from "@/lib/db"

interface RecordingHistoryProps {
  storage: ReturnType<typeof useRecordingStorage>
  onBack: () => void
}

export function RecordingHistory({ storage, onBack }: RecordingHistoryProps) {
  const { recordings, loading, refresh, remove, rename } = storage
  const [query, setQuery] = useState("")
  const [playing, setPlaying] = useState<Recording | null>(null)

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recordings
    return recordings.filter((r) => r.name.toLowerCase().includes(q))
  }, [recordings, query])

  if (playing) {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center gap-4 p-6">
        <VideoPreview
          recording={playing}
          onReset={() => setPlaying(null)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Recordings Library</h2>
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {recordings.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recordings..."
              className="h-7 w-52 rounded-sm border border-border bg-input pl-8 pr-2.5 text-xs text-foreground outline-none focus:border-ring"
            />
          </div>
          <Button
            variant="default"
            size="xs"
            onClick={onBack}
            className="gap-1.5 rounded-sm"
          >
            <MonitorIcon className="size-3.5" />
            New Recording
          </Button>
        </div>
      </div>

      {loading && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Loading recordings...
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 py-12 text-center">
          <HistoryIcon className="size-8 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            {recordings.length === 0
              ? "No recordings yet"
              : "No recordings match your search"}
          </p>
          {recordings.length === 0 && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onBack}
              className="mt-1 gap-1.5 rounded-sm"
            >
              <MonitorIcon className="size-3.5" />
              Record your first video
            </Button>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 overflow-y-auto md:grid-cols-2">
          {filtered.map((rec) => (
            <HistoryItem
              key={rec.id}
              recording={rec}
              onPlay={setPlaying}
              onDelete={remove}
              onRename={rename}
            />
          ))}
        </div>
      )}
    </div>
  )
}
