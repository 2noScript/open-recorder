import Image from "next/image";
import {
  AppWindow,
  Film,
  Mic,
  MousePointerClick,
  Scissors,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DownloadsGrid,
  HeroDownloadAction,
} from "@/components/download-section";
import { REPO_URL } from "@/lib/releases";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const FEATURES = [
  {
    icon: AppWindow,
    title: "Display, Region & App Window Capture",
    description:
      "Record fullscreen displays, drag a custom region directly on the live preview, or target any open application window with search and multi-monitor support.",
  },
  {
    icon: Mic,
    title: "Microphone & Real-Time VU Meter",
    description:
      "Select audio input devices and monitor microphone levels live before and during recording.",
  },
  {
    icon: MousePointerClick,
    title: "Mouse Highlight, Keystrokes & Camera PiP",
    description:
      "Show system-wide click highlights, live keystroke badges, optional camera PiP, and screen annotations.",
  },
  {
    icon: Scissors,
    title: "Instant Trim & GIF Export",
    description:
      "Preview recordings directly from disk, trim clips with FFmpeg, and export crisp GIFs in seconds.",
  },
  {
    icon: Film,
    title: "Local Library & Thumbnails",
    description:
      "Recordings and thumbnails are stored cleanly on disk with fast SQLite indexing and instant playback.",
  },
  {
    icon: Settings2,
    title: "Diagnostics & Tray Controls",
    description:
      "Built-in Settings tab for FFmpeg checks, storage paths, OS privacy shortcuts, and quick system tray access.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-muted/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <a href="#" className="flex items-center gap-2.5">
            <Image
              src={`${BASE_PATH}/logo.png`}
              alt="Open Recorder"
              width={28}
              height={28}
              className="size-7 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight">
              Open Recorder
            </span>
          </a>

          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#downloads">Download</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-12 text-center">
          <Badge className="mb-4">Open Source Desktop Screen Recorder</Badge>

          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Capture screens, regions &amp; app windows without the bloat.
          </h1>

          <p className="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed">
            A lightweight, capture-first desktop recorder for macOS, Windows,
            and Linux. Built with live previews, audio monitoring, input
            overlays, fast trimming, and GIF export.
          </p>

          <div className="mt-8">
            <HeroDownloadAction />
          </div>

          <div className="mt-12 w-full overflow-hidden rounded-lg border border-border bg-muted shadow-2xl">
            <Image
              src={`${BASE_PATH}/preview.png`}
              alt="Open Recorder desktop application preview"
              width={1280}
              height={840}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-8">
            <Badge variant="secondary" className="mb-2">
              Studio Workflow
            </Badge>
            <h2 className="text-xl font-semibold tracking-tight">
              Everything you need for crisp screen recordings
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title}>
                  <CardHeader>
                    <div className="mb-2 flex size-8 items-center justify-center rounded-md bg-secondary text-primary">
                      <Icon className="size-4" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Downloads Section */}
        <DownloadsGrid />
      </main>

      <footer className="border-t border-border bg-muted/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src={`${BASE_PATH}/logo.png`}
              alt="Open Recorder"
              width={18}
              height={18}
              className="size-4.5 object-contain"
            />
            <span>Open Recorder · MIT / Open Source</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`${REPO_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Releases
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Source Code
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
