import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MonitorIcon,
  InfoIcon,
  MicIcon,
  Volume2Icon,
  MousePointer2Icon,
  KeyboardIcon,
  CameraIcon,
  TypeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TimerIcon,
} from "lucide-react"
import type { RecordingConfig } from "@/hooks/use-screen-recorder"
import { RESOLUTION_PRESETS } from "@/hooks/use-screen-recorder"

interface RecordingSettingsProps {
  config: RecordingConfig
  onChange: (config: RecordingConfig) => void
  onStart: () => void
  hasRegionSelected: boolean
}

export function RecordingSettings({
  config,
  onChange,
  onStart,
  hasRegionSelected,
}: RecordingSettingsProps) {
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [overlaysOpen, setOverlaysOpen] = useState(false)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const mics = devices.filter((d) => d.kind === "audioinput")
      setMicDevices(mics)
      if (!config.micDeviceId && mics.length > 0) {
        onChange({ ...config, micDeviceId: mics[0].deviceId })
      }
      const cams = devices.filter((d) => d.kind === "videoinput")
      setCameraDevices(cams)
      if (!config.cameraDeviceId && cams.length > 0) {
        onChange({ ...config, cameraDeviceId: cams[0].deviceId })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(partial: Partial<RecordingConfig>) {
    onChange({ ...config, ...partial })
  }

  return (
    <TooltipProvider>
      <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Screen Recorder</CardTitle>
          <CardDescription>Configure your recording settings</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <MonitorIcon className="size-5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Capture Source</span>
                <span className="text-xs text-muted-foreground">
                  Your browser will ask you to choose
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label>Mode</Label>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Region lets you select a portion of the screen</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-1 rounded-lg border p-0.5">
              <Button
                variant={config.mode === "fullscreen" ? "default" : "ghost"}
                size="sm"
                onClick={() => update({ mode: "fullscreen" })}
              >
                Fullscreen
              </Button>
              <Button
                variant={config.mode === "region" ? "default" : "ghost"}
                size="sm"
                onClick={() => update({ mode: "region" })}
              >
                Region {hasRegionSelected ? "✓" : ""}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label>Resolution</Label>
            <Select
              value={config.resolution}
              onValueChange={(v) =>
                update({ resolution: v as RecordingConfig["resolution"] })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(RESOLUTION_PRESETS).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "original" ? "Original" : r.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label>Frame Rate</Label>
            <Select
              value={String(config.fps)}
              onValueChange={(v) =>
                update({ fps: Number(v) as RecordingConfig["fps"] })
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 60].map((f) => (
                  <SelectItem key={f} value={String(f)}>
                    {f} FPS
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TimerIcon className="size-4 text-muted-foreground" />
              <Label>Countdown</Label>
            </div>
            <Select
              value={String(config.countdown)}
              onValueChange={(v) =>
                update({ countdown: Number(v) as RecordingConfig["countdown"] })
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">None</SelectItem>
                <SelectItem value="3">3s</SelectItem>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-3" />

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Volume2Icon className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium">System Audio</span>
              </div>
              <Switch
                checked={config.systemAudio}
                onCheckedChange={(v) => update({ systemAudio: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <MicIcon className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium">Microphone</span>
              </div>
              <Switch
                checked={config.micEnabled}
                onCheckedChange={(v) => update({ micEnabled: v })}
              />
            </div>

            {config.micEnabled && micDevices.length > 0 && (
              <div className="flex items-center justify-between gap-4 pl-2">
                <Label className="text-xs text-muted-foreground">Device</Label>
                <Select
                  value={config.micDeviceId}
                  onValueChange={(v) => update({ micDeviceId: v })}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {micDevices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label || d.deviceId.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setOverlaysOpen(!overlaysOpen)}
              className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {overlaysOpen ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronRightIcon className="size-4" />
              )}
              Overlays & Effects
            </button>

            {overlaysOpen && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <MousePointer2Icon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Mouse Highlight</span>
                  </div>
                  <Switch
                    checked={config.showMouseHighlight}
                    onCheckedChange={(v) =>
                      update({ showMouseHighlight: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <KeyboardIcon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Keystroke Display</span>
                  </div>
                  <Switch
                    checked={config.showKeystrokes}
                    onCheckedChange={(v) =>
                      update({ showKeystrokes: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <CameraIcon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Camera PiP</span>
                  </div>
                  <Switch
                    checked={config.cameraEnabled}
                    onCheckedChange={(v) => update({ cameraEnabled: v })}
                  />
                </div>
                {config.cameraEnabled && cameraDevices.length > 0 && (
                  <div className="flex items-center justify-between gap-4 pl-2">
                    <Label className="text-xs text-muted-foreground">Device</Label>
                    <Select
                      value={config.cameraDeviceId}
                      onValueChange={(v) => update({ cameraDeviceId: v })}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cameraDevices.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>
                            {d.label || d.deviceId.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <TypeIcon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Watermark</span>
                  </div>
                  <Switch
                    checked={config.watermarkEnabled}
                    onCheckedChange={(v) =>
                      update({ watermarkEnabled: v })
                    }
                  />
                </div>

                {config.watermarkEnabled && (
                  <div className="space-y-2 pl-2">
                    <div className="flex items-center gap-2">
                      <Label className="w-12 text-xs">Text</Label>
                      <input
                        className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                        value={config.watermarkText}
                        onChange={(e) =>
                          update({ watermarkText: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-12 text-xs">Opacity</Label>
                      <Slider
                        value={[config.watermarkOpacity]}
                        onValueChange={([v]) =>
                          update({ watermarkOpacity: v })
                        }
                        max={1}
                        step={0.05}
                        className="flex-1"
                      />
                      <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                        {Math.round(config.watermarkOpacity * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button onClick={onStart} className="mt-2 w-full gap-2">
            <MonitorIcon className="size-4" />
            Start Recording
          </Button>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
