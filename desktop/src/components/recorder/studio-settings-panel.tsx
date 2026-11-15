import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VuMeter } from "@/components/recorder/vu-meter"
import {
  getRecordingsDir,
  listAudioDevices,
  openRecordingsDir,
  type AudioDeviceInfo,
} from "@/lib/tauri"
import type { RecordingConfig } from "@/hooks/use-screen-recorder"
import { Button } from "@/components/ui/button"
import {
  CameraIcon,
  FolderOpenIcon,
  LayersIcon,
  MicIcon,
  SlidersHorizontalIcon,
  VideoIcon,
} from "lucide-react"

type SettingsTab = "video" | "audio" | "overlays" | "general"

interface StudioSettingsPanelProps {
  config: RecordingConfig
  onChange: (next: RecordingConfig) => void
  micVolume: number
  disabled?: boolean
}

export function StudioSettingsPanel({
  config,
  onChange,
  micVolume,
  disabled = false,
}: StudioSettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>("video")
  const [micDevices, setMicDevices] = useState<AudioDeviceInfo[]>([])
  const [recordingsDir, setRecordingsDir] = useState("")

  useEffect(() => {
    getRecordingsDir().then(setRecordingsDir).catch(() => {})
    listAudioDevices()
      .then((mics) => {
        setMicDevices(mics)
        if (!config.micDeviceId && mics.length > 0) {
          const def = mics.find((m) => m.isDefault) ?? mics[0]
          onChange({ ...config, micDeviceId: def.id })
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(partial: Partial<RecordingConfig>) {
    onChange({ ...config, ...partial })
  }

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof VideoIcon }> = [
    { id: "video", label: "Video", icon: VideoIcon },
    { id: "audio", label: "Audio", icon: MicIcon },
    { id: "overlays", label: "Overlays", icon: LayersIcon },
    { id: "general", label: "General", icon: SlidersHorizontalIcon },
  ]

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="grid grid-cols-4 border-b border-border bg-sidebar p-1">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-sm py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "video" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resolution</Label>
              <Select
                disabled={disabled}
                value={config.resolution}
                onValueChange={(v) =>
                  update({ resolution: v as RecordingConfig["resolution"] })
                }
              >
                <SelectTrigger className="w-full rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p HD (1280×720)</SelectItem>
                  <SelectItem value="1080p">1080p Full HD (1920×1080)</SelectItem>
                  <SelectItem value="4K">4K UHD (3840×2160)</SelectItem>
                  <SelectItem value="original">Original Display</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Frame Rate</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {([15, 30, 60] as const).map((fps) => (
                  <button
                    key={fps}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ fps })}
                    className={`rounded-sm border py-1.5 text-xs font-medium transition-colors ${
                      config.fps === fps
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "audio" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">System Audio</Label>
                <p className="text-[11px] text-muted-foreground">
                  Capture desktop sound
                </p>
              </div>
              <Switch
                disabled={disabled}
                checked={config.systemAudio}
                onCheckedChange={(checked) => update({ systemAudio: checked })}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Microphone</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Record voice input
                  </p>
                </div>
                <Switch
                  disabled={disabled}
                  checked={config.micEnabled}
                  onCheckedChange={(checked) => update({ micEnabled: checked })}
                />
              </div>

              {config.micEnabled && micDevices.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Input Device
                  </Label>
                  <Select
                    disabled={disabled}
                    value={config.micDeviceId}
                    onValueChange={(v) => update({ micDeviceId: v })}
                  >
                    <SelectTrigger className="w-full rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {micDevices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.micEnabled && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Input Level
                  </Label>
                  <VuMeter volume={micVolume} />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "overlays" && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Mouse Highlight</Label>
                <p className="text-[11px] text-muted-foreground">
                  Highlight cursor & clicks
                </p>
              </div>
              <Switch
                disabled={disabled}
                checked={config.showMouseHighlight}
                onCheckedChange={(checked) =>
                  update({ showMouseHighlight: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Keystroke HUD</Label>
                <p className="text-[11px] text-muted-foreground">
                  Show pressed shortcuts
                </p>
              </div>
              <Switch
                disabled={disabled}
                checked={config.showKeystrokes}
                onCheckedChange={(checked) =>
                  update({ showKeystrokes: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Screen Annotations</Label>
                <p className="text-[11px] text-muted-foreground">
                  Draw while recording
                </p>
              </div>
              <Switch
                disabled={disabled}
                checked={config.annotationsEnabled}
                onCheckedChange={(checked) =>
                  update({ annotationsEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <CameraIcon className="size-3.5 text-muted-foreground" />
                <div>
                  <Label className="text-xs font-medium">Camera PiP</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Webcam corner bubble
                  </p>
                </div>
              </div>
              <Switch
                disabled={disabled}
                checked={config.cameraEnabled}
                onCheckedChange={(checked) => update({ cameraEnabled: checked })}
              />
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Watermark</Label>
                <Switch
                  disabled={disabled}
                  checked={config.watermarkEnabled}
                  onCheckedChange={(checked) =>
                    update({ watermarkEnabled: checked })
                  }
                />
              </div>
              {config.watermarkEnabled && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    disabled={disabled}
                    value={config.watermarkText}
                    onChange={(e) => update({ watermarkText: e.target.value })}
                    placeholder="Watermark text"
                    className="h-8 w-full rounded-sm border border-border bg-input px-2.5 text-xs text-foreground outline-none focus:border-ring"
                  />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Opacity: {Math.round(config.watermarkOpacity * 100)}%
                    </Label>
                    <Slider
                      disabled={disabled}
                      value={[config.watermarkOpacity]}
                      onValueChange={(v) => update({ watermarkOpacity: v[0] })}
                      min={0.1}
                      max={1}
                      step={0.05}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "general" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Countdown Timer
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 3, 5].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ countdown: sec })}
                    className={`rounded-sm border py-1.5 text-xs font-medium transition-colors ${
                      config.countdown === sec
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {sec === 0 ? "Off" : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Storage Location</p>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => openRecordingsDir()}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <FolderOpenIcon className="size-3" />
                  Open
                </Button>
              </div>
              <p className="break-all font-mono text-[10px] text-muted-foreground">
                {recordingsDir || "~/Movies/OpenRecorder"}
              </p>
              <p>
                Recordings are saved as <code>.mp4</code> files in this folder.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
