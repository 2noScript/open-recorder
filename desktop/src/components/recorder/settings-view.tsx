import { useCallback, useEffect, useState } from "react"
import {
  DEFAULT_CONFIG,
  type RecordingConfig,
} from "@/hooks/use-screen-recorder"
import { Button } from "@/components/ui/button"
import {
  checkPermissions,
  getSystemInfo,
  openPrivacySettings,
  openRecordingsDir,
  type PermissionStatus,
  type SystemInfo,
} from "@/lib/tauri"
import {
  CheckCircle2Icon,
  DatabaseIcon,
  FolderOpenIcon,
  KeyboardIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  XCircleIcon,
} from "lucide-react"

interface SettingsViewProps {
  config: RecordingConfig
  onChange: (next: RecordingConfig) => void
  disabled?: boolean
}

export function SettingsView({
  config,
  onChange,
  disabled = false,
}: SettingsViewProps) {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInfo = useCallback(async () => {
    const [info, perms] = await Promise.all([
      getSystemInfo(),
      checkPermissions(),
    ])
    return { info, perms }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { info, perms } = await fetchInfo()
      setSysInfo(info)
      setPermissions(perms)
    } catch {
      // ignore if outside Tauri
    } finally {
      setLoading(false)
    }
  }, [fetchInfo])

  useEffect(() => {
    let cancelled = false
    fetchInfo()
      .then(({ info, perms }) => {
        if (!cancelled) {
          setSysInfo(info)
          setPermissions(perms)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchInfo])

  const update = <K extends keyof RecordingConfig>(
    key: K,
    value: RecordingConfig[K]
  ) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Settings</h1>
          <p className="text-[11px] text-muted-foreground">
            FFmpeg engine status, storage paths, permissions, and recording defaults.
          </p>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={refresh}
          disabled={loading}
          className="gap-1.5 rounded-sm text-xs"
        >
          <RefreshCwIcon
            className={`size-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh Status
        </Button>
      </div>

      {/* FFmpeg Status */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="size-4 text-primary" />
            <div>
              <h2 className="text-sm font-medium text-foreground">FFmpeg</h2>
              <p className="text-[11px] text-muted-foreground">
                {sysInfo
                  ? sysInfo.ffmpegInstalled
                    ? sysInfo.ffmpegPath ?? "Đã cài đặt trên máy"
                    : "Chưa tải / chưa tìm thấy FFmpeg"
                  : loading
                    ? "Đang kiểm tra FFmpeg..."
                    : "Không thể kiểm tra FFmpeg"}
              </p>
            </div>
          </div>
          {sysInfo && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                sysInfo.ffmpegInstalled
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {sysInfo.ffmpegInstalled ? (
                <>
                  <CheckCircle2Icon className="size-3" />
                  Đã cài đặt
                </>
              ) : (
                <>
                  <XCircleIcon className="size-3" />
                  Chưa cài đặt
                </>
              )}
            </span>
          )}
        </div>

        {sysInfo && !sysInfo.ffmpegInstalled && (
          <div className="mt-3 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            FFmpeg là bắt buộc để quay màn hình, cắt video, tạo thumbnail và xuất GIF.
            Cài đặt bằng Homebrew:{" "}
            <code className="rounded-sm bg-background/60 px-1.5 py-0.5 font-mono text-[11px]">
              brew install ffmpeg
            </code>
          </div>
        )}
      </section>

      {/* Storage & Database */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DatabaseIcon className="size-4 text-primary" />
            <h2 className="text-sm font-medium text-foreground">
              Storage
            </h2>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => openRecordingsDir().catch(() => {})}
            className="gap-1.5 rounded-sm text-xs"
          >
            <FolderOpenIcon className="size-3.5" />
            Open Recordings Folder
          </Button>
        </div>

        {sysInfo ? (
          <div className="grid gap-2.5 text-xs">
            <InfoRow label="Recordings Folder" value={sysInfo.recordingsDir} mono />
            <InfoRow label="Library Data" value={sysInfo.dbPath} mono />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Loading paths...</p>
        )}
      </section>

      {/* OS Permissions */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">
            System Permissions
          </h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <PermissionCard
            label="Screen Recording"
            granted={permissions?.screenRecording ?? false}
            onOpen={() => openPrivacySettings("screen").catch(() => {})}
          />
          <PermissionCard
            label="Microphone"
            granted={permissions?.microphone ?? false}
            onOpen={() => openPrivacySettings("mic").catch(() => {})}
          />
          <PermissionCard
            label="Accessibility"
            granted={permissions?.accessibility ?? false}
            onOpen={() => openPrivacySettings("accessibility").catch(() => {})}
          />
        </div>
      </section>

      {/* Default Recording Parameters */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontalIcon className="size-4 text-primary" />
            <h2 className="text-sm font-medium text-foreground">
              Recording Defaults
            </h2>
          </div>
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => onChange({ ...DEFAULT_CONFIG })}
            className="gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcwIcon className="size-3" />
            Reset Defaults
          </Button>
        </div>

        <div className="grid gap-4 text-xs sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Capture Mode
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-sm bg-secondary p-0.5">
              {(["fullscreen", "region"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => update("mode", mode)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    config.mode === mode
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "fullscreen" ? "Full Screen" : "Custom Region"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Resolution
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-sm bg-secondary p-0.5">
              {(["720p", "1080p", "4K", "original"] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  disabled={disabled}
                  onClick={() => update("resolution", res)}
                  className={`rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                    config.resolution === res
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {res === "original" ? "Native" : res}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Frame Rate (FPS)
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-sm bg-secondary p-0.5">
              {([15, 30, 60] as const).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  disabled={disabled}
                  onClick={() => update("fps", fps)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                    config.fps === fps
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Countdown Timer
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-sm bg-secondary p-0.5">
              {[0, 3, 5].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={disabled}
                  onClick={() => update("countdown", sec)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                    config.countdown === sec
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sec === 0 ? "Off" : `${sec}s`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-3">
          <ToggleRow
            label="Microphone"
            checked={config.micEnabled}
            disabled={disabled}
            onChange={(v) => update("micEnabled", v)}
          />
          <ToggleRow
            label="System Audio"
            checked={config.systemAudio}
            disabled={disabled}
            onChange={(v) => update("systemAudio", v)}
          />
          <ToggleRow
            label="Mouse Highlight"
            checked={config.showMouseHighlight}
            disabled={disabled}
            onChange={(v) => update("showMouseHighlight", v)}
          />
          <ToggleRow
            label="Keystroke Display"
            checked={config.showKeystrokes}
            disabled={disabled}
            onChange={(v) => update("showKeystrokes", v)}
          />
          <ToggleRow
            label="Camera PiP"
            checked={config.cameraEnabled}
            disabled={disabled}
            onChange={(v) => update("cameraEnabled", v)}
          />
          <ToggleRow
            label="Annotations"
            checked={config.annotationsEnabled}
            disabled={disabled}
            onChange={(v) => update("annotationsEnabled", v)}
          />
        </div>
      </section>

      {/* Global Shortcuts */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <KeyboardIcon className="size-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">
            Global Shortcuts
          </h2>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Start / Stop Recording</span>
            <kbd className="rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground">
              ⌘ ⇧ R
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pause / Resume</span>
            <kbd className="rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground">
              ⌘ ⇧ P
            </kbd>
          </div>
        </div>
      </section>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm bg-secondary/60 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={`truncate text-xs text-foreground ${mono ? "font-mono text-[11px]" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

function PermissionCard({
  label,
  granted,
  onOpen,
}: {
  label: string
  granted: boolean
  onOpen: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-sm bg-secondary/60 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${
            granted ? "bg-primary" : "bg-destructive"
          }`}
        />
        <span className="text-foreground">{label}</span>
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={onOpen}
        className="h-6 rounded-sm px-2 text-[11px] text-primary hover:bg-card"
      >
        Open
      </Button>
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-sm bg-secondary/60 px-3 py-2">
      <span className="text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-primary"
      />
    </label>
  )
}
