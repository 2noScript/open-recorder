import { useCallback, useState } from "react"
import { save } from "@tauri-apps/plugin-dialog"
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
import { exportDesktopGif } from "@/lib/tauri"
import { getMediaUrl } from "@/lib/db"

interface GifExporterProps {
  videoPath: string
  duration: number
  onClose: () => void
}

export function GifExporter({ videoPath, duration, onClose }: GifExporterProps) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(Math.min(duration / 1000, 5))
  const [gifFps, setGifFps] = useState(10)
  const [exporting, setExporting] = useState(false)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    const dest = await save({
      defaultPath: `recording-${Date.now()}.gif`,
      filters: [{ name: "GIF Image", extensions: ["gif"] }],
    })
    if (!dest) return

    setExporting(true)
    setError(null)
    try {
      const savedPath = await exportDesktopGif({
        inputPath: videoPath,
        outputPath: dest,
        startSec: start,
        endSec: end,
        fps: gifFps,
        width: 720,
      })
      setOutputPath(savedPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }, [start, end, gifFps, videoPath])

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
            onValueChange={(v) => setStart(v[0])}
            min={0}
            max={Math.max(0.1, duration / 1000 - 0.5)}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Label>End: {end.toFixed(1)}s</Label>
          <Slider
            value={[end]}
            onValueChange={(v) => setEnd(v[0])}
            min={start + 0.5}
            max={Math.max(start + 0.5, duration / 1000)}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Label>FPS: {gifFps}</Label>
          <Slider
            value={[gifFps]}
            onValueChange={(v) => setGifFps(v[0])}
            min={5}
            max={20}
            step={1}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {outputPath && (
          <img
            src={getMediaUrl(outputPath)}
            alt="GIF Preview"
            className="w-full rounded-md"
          />
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={handleExport} disabled={exporting} className="gap-2">
          {exporting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <FileImageIcon className="size-4" />
          )}
          {exporting ? "Exporting..." : "Export GIF"}
        </Button>
      </CardFooter>
    </Card>
  )
}
