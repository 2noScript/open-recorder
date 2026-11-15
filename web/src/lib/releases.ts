export type PlatformKey =
  | "macos-arm64"
  | "macos-x64"
  | "windows"
  | "linux-appimage"
  | "linux-deb";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface LatestReleaseInfo {
  tagName: string;
  htmlUrl: string;
  assets: Partial<Record<PlatformKey, ReleaseAsset>>;
}

export const REPO_URL = "https://github.com/2noScript/open-recorder";
export const RELEASES_LATEST_URL = `${REPO_URL}/releases/latest`;
const RELEASES_API_URL =
  "https://api.github.com/repos/2noScript/open-recorder/releases/latest";

export function matchAssetPlatform(filename: string): PlatformKey | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".dmg")) {
    if (lower.includes("aarch64") || lower.includes("arm64")) {
      return "macos-arm64";
    }
    return "macos-x64";
  }
  if (lower.endsWith(".msi") || lower.endsWith("-setup.exe")) {
    return "windows";
  }
  if (lower.endsWith(".appimage")) {
    return "linux-appimage";
  }
  if (lower.endsWith(".deb")) {
    return "linux-deb";
  }
  return null;
}

export function detectVisitorPlatform(): PlatformKey {
  if (typeof navigator === "undefined") return "macos-arm64";
  const ua = navigator.userAgent.toLowerCase();
  const platform =
    (
      navigator as Navigator & {
        userAgentData?: { platform?: string };
      }
    ).userAgentData?.platform?.toLowerCase() ??
    navigator.platform?.toLowerCase() ??
    "";

  if (ua.includes("win") || platform.includes("win")) {
    return "windows";
  }
  if (ua.includes("linux") || platform.includes("linux")) {
    return "linux-appimage";
  }
  return "macos-arm64";
}

export async function fetchLatestRelease(): Promise<LatestReleaseInfo | null> {
  try {
    const res = await fetch(RELEASES_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      assets?: ReleaseAsset[];
    };
    const assets: Partial<Record<PlatformKey, ReleaseAsset>> = {};
    for (const asset of data.assets ?? []) {
      const key = matchAssetPlatform(asset.name);
      if (key && !assets[key]) {
        assets[key] = asset;
      }
    }
    return {
      tagName: data.tag_name ?? "v0.1.0",
      htmlUrl: data.html_url ?? RELEASES_LATEST_URL,
      assets,
    };
  } catch {
    return null;
  }
}

export function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
