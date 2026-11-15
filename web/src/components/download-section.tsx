"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Apple, Monitor, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RELEASES_LATEST_URL,
  detectVisitorPlatform,
  fetchLatestRelease,
  formatBytes,
  type LatestReleaseInfo,
  type PlatformKey,
} from "@/lib/releases";

const PLATFORM_CARDS: {
  key: PlatformKey;
  label: string;
  subtitle: string;
  ext: string;
  icon: typeof Apple;
}[] = [
  {
    key: "macos-arm64",
    label: "macOS (Apple Silicon)",
    subtitle: "M1 / M2 / M3 / M4 Macs",
    ext: ".dmg",
    icon: Apple,
  },
  {
    key: "macos-x64",
    label: "macOS (Intel)",
    subtitle: "x86_64 Macs",
    ext: ".dmg",
    icon: Apple,
  },
  {
    key: "windows",
    label: "Windows",
    subtitle: "Windows 10 & 11 (64-bit)",
    ext: ".msi / .exe",
    icon: Monitor,
  },
  {
    key: "linux-appimage",
    label: "Linux (AppImage)",
    subtitle: "Universal portable binary",
    ext: ".AppImage",
    icon: Terminal,
  },
  {
    key: "linux-deb",
    label: "Linux (Debian / Ubuntu)",
    subtitle: "APT package installer",
    ext: ".deb",
    icon: Terminal,
  },
];

export function HeroDownloadAction() {
  const [release, setRelease] = useState<LatestReleaseInfo | null>(null);
  const [visitorPlatform, setVisitorPlatform] =
    useState<PlatformKey>("macos-arm64");

  useEffect(() => {
    void fetchLatestRelease().then((info) => {
      setVisitorPlatform(detectVisitorPlatform());
      setRelease(info);
    });
  }, []);

  const matchedAsset = release?.assets[visitorPlatform];
  const primaryHref = matchedAsset?.browser_download_url ?? RELEASES_LATEST_URL;
  const activeMeta = PLATFORM_CARDS.find((p) => p.key === visitorPlatform);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" asChild>
          <a href={primaryHref}>
            <Download className="size-4" />
            Download for {activeMeta?.label ?? "Desktop"}
            {release?.tagName ? ` (${release.tagName})` : ""}
          </a>
        </Button>
        <Button size="lg" variant="secondary" asChild>
          <a href="#downloads">All Platforms</a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {matchedAsset
          ? `Direct installer (${matchedAsset.name}${
              formatBytes(matchedAsset.size)
                ? ` · ${formatBytes(matchedAsset.size)}`
                : ""
            })`
          : "Free & open source · macOS, Windows & Linux"}
      </p>
    </div>
  );
}

export function DownloadsGrid() {
  const [release, setRelease] = useState<LatestReleaseInfo | null>(null);

  useEffect(() => {
    void fetchLatestRelease().then(setRelease);
  }, []);

  return (
    <section id="downloads" className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="mb-2">
            {release?.tagName ? `Latest ${release.tagName}` : "GitHub Releases"}
          </Badge>
          <h2 className="text-xl font-semibold tracking-tight">
            Download Open Recorder
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the installer for your operating system, or browse all builds
            on GitHub.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={release?.htmlUrl ?? RELEASES_LATEST_URL}
            target="_blank"
            rel="noreferrer"
          >
            View Release Notes
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_CARDS.map((item) => {
          const Icon = item.icon;
          const asset = release?.assets[item.key];
          const href = asset?.browser_download_url ?? RELEASES_LATEST_URL;
          const sizeLabel = formatBytes(asset?.size);

          return (
            <Card
              key={item.key}
              className="flex flex-col justify-between transition-colors hover:border-primary/50"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-8 items-center justify-center rounded-md bg-secondary text-primary">
                    <Icon className="size-4" />
                  </div>
                  <Badge variant="secondary">{item.ext}</Badge>
                </div>
                <CardTitle className="pt-2">{item.label}</CardTitle>
                <CardDescription>{item.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" size="sm" className="w-full" asChild>
                  <a href={href}>
                    <Download className="size-3.5" />
                    {asset
                      ? `Download${sizeLabel ? ` (${sizeLabel})` : ""}`
                      : "Download from Releases"}
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
