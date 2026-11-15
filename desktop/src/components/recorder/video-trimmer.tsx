import { useCallback, useState } from "react"
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
import { Loader2Icon, ScissorsIcon } from "lucide-react"
import { trimDesktopRecording } from "@/lib/tauri"
import type { Recording } from "@/lib/db"

interface VideoTrimmerProps {
  recording: Recording
  onDone: (trimmed: Recording) => void
  onClose: () => void
}

export function VideoTrimmer({
  recording,
  onDone,
  onClose,
}: VideoTrimmerProps) {
  const maxSec = Math.max(0.5, recording.duration / 1000)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(maxSec)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTrim = useCallback(async () => {
    setExporting(true)
    setError(null)
    try {
      const trimmed = await trimDesktopRecording({
        recordingId: recording.id,
        startSec: start,
        endSec: end,
      })
      onDone(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }, [recording.id, start, end, onDone])

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
            onValueChange={(v) => setStart(v[0])}
            min={0}
            max={Math.max(0.1, end - 0.5)}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Label>End: {end.toFixed(1)}s</Label>
          <Slider
            value={[end]}
            onValueChange={(v) => setEnd(v[0])}
            min={start + 0.5}
            max={maxSec}
            step={0.1}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleTrim} disabled={exporting} className="gap-2">
          {exporting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <ScissorsIcon className="size-4" />
          )}
          {exporting ? "Trimming..." : "Trim"}
        </Button>
      </CardFooter>
    </Card>
  )
}
