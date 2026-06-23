import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { MicIcon, Volume2Icon } from "lucide-react"

interface AudioMixerProps {
  micVolume: number
  systemVolume: number
  onMicVolumeChange: (v: number) => void
  onSystemVolumeChange: (v: number) => void
  hasMic: boolean
  hasSystemAudio: boolean
}

export function AudioMixer({
  micVolume,
  systemVolume,
  onMicVolumeChange,
  onSystemVolumeChange,
  hasMic,
  hasSystemAudio,
}: AudioMixerProps) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">Audio Mixer</p>
      {hasSystemAudio && (
        <div className="flex items-center gap-3">
          <Volume2Icon className="size-4 text-muted-foreground" />
          <Label className="w-20 text-xs">System</Label>
          <Slider
            value={[systemVolume]}
            onValueChange={([v]) => onSystemVolumeChange(v)}
            max={1}
            step={0.05}
            className="flex-1"
          />
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(systemVolume * 100)}%
          </span>
        </div>
      )}
      {hasMic && (
        <div className="flex items-center gap-3">
          <MicIcon className="size-4 text-muted-foreground" />
          <Label className="w-20 text-xs">Microphone</Label>
          <Slider
            value={[micVolume]}
            onValueChange={([v]) => onMicVolumeChange(v)}
            max={1}
            step={0.05}
            className="flex-1"
          />
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(micVolume * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}
