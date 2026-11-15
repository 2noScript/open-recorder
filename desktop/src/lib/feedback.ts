import { getVersion } from "@tauri-apps/api/app"
import { openUrl } from "@tauri-apps/plugin-opener"
import { getSystemInfo } from "@/lib/tauri"

const GITHUB_ISSUES_NEW_URL =
  "https://github.com/2noScript/open-recorder/issues/new"

export interface FeedbackContext {
  appVersion?: string | null
  os?: string | null
  ffmpegVersion?: string | null
}

/**
 * Opens GitHub's new issue form in the default browser with pre-filled
 * environment diagnostics so users can report bugs or request features quickly.
 */
export async function openGitHubFeedback(
  kind: "bug" | "feature",
  context?: FeedbackContext
): Promise<void> {
  let appVersion = context?.appVersion ?? null
  let os = context?.os ?? null
  let ffmpegVersion = context?.ffmpegVersion ?? null

  if (!appVersion || !os) {
    const [verRes, sysRes] = await Promise.allSettled([
      appVersion ? Promise.resolve(appVersion) : getVersion(),
      os ? Promise.resolve(null) : getSystemInfo(),
    ])
    if (verRes.status === "fulfilled" && verRes.value) {
      appVersion = verRes.value
    }
    if (sysRes.status === "fulfilled" && sysRes.value) {
      os = `${sysRes.value.os} (${sysRes.value.arch})`
      ffmpegVersion = sysRes.value.ffmpegInstalled
        ? sysRes.value.ffmpegVersion ?? "Installed"
        : "Not found"
    }
  }

  const params = new URLSearchParams()
  if (kind === "bug") {
    params.set("labels", "bug")
    params.set("title", "[Bug]: ")
    params.set(
      "body",
      [
        "## Describe the bug",
        "",
        "",
        "## Steps to reproduce",
        "1. ",
        "2. ",
        "",
        "## Environment",
        `- **App Version:** ${appVersion ? `v${appVersion}` : "Unknown"}`,
        `- **OS:** ${os ?? navigator.platform}`,
        `- **FFmpeg:** ${ffmpegVersion ?? "Unknown"}`,
      ].join("\n")
    )
  } else {
    params.set("labels", "enhancement")
    params.set("title", "[Feature]: ")
    params.set(
      "body",
      [
        "## Feature description",
        "",
        "",
        "## Use case",
        "",
      ].join("\n")
    )
  }

  await openUrl(`${GITHUB_ISSUES_NEW_URL}?${params.toString()}`)
}
