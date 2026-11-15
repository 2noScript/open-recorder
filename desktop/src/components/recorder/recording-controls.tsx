import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { RecordingTimer } from "@/components/recorder/recording-timer"
import { VuMeter } from "@/components/recorder/vu-meter"
import {
  PauseIcon,
  PlayIcon,
  SquareIcon,
} from "lucide-react"
import type { RecorderStatus } from "@/hooks/use-screen-recorder"

interface RecordingControlsProps {
  status: RecorderStatus
  elapsed: number
  fileSize: number
  volume: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function RecordingControls({
  status,
  elapsed,
  fileSize,
  volume,
  onPause,
  onResume,
  onStop,
}: RecordingControlsProps) {
  const isPaused = status === "paused"

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center gap-1">
        <RecordingTimer
          elapsed={elapsed}
          fileSize={fileSize}
          isPaused={isPaused}
        />
        <VuMeter volume={volume} className="mt-1" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-3">
          {status === "recording" ? (
            <Button
              variant="outline"
              size="lg"
              onClick={onPause}
              className="gap-2"
            >
              <PauseIcon className="size-4" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              onClick={onResume}
              className="gap-2"
            >
              <PlayIcon className="size-4" />
              Resume
            </Button>
          )}
          <Button
            variant="destructive"
            size="lg"
            onClick={onStop}
            className="gap-2"
          >
            <SquareIcon className="size-4" />
            Stop
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-center gap-2 text-xs text-muted-foreground">
        <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
          Ctrl+Shift+P
        </kbd>
        <span>pause</span>
        <span className="mx-1">·</span>
        <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
          Ctrl+Shift+S
        </kbd>
        <span>stop</span>
      </CardFooter>
    </Card>
  )
}
