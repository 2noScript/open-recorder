import { RecorderPage } from "@/components/recorder/recorder-page"
import { MouseHighlighter } from "@/components/recorder/mouse-highlighter"
import { KeystrokeDisplay } from "@/components/recorder/keystroke-display"
import { useCursorTracker } from "@/hooks/use-cursor-tracker"
import { useKeyboardTracker } from "@/hooks/use-keyboard-tracker"

function OverlayWindow() {
  const cursor = useCursorTracker()
  const keyboard = useKeyboardTracker()

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-transparent">
      <MouseHighlighter cursor={cursor} />
      <KeystrokeDisplay events={keyboard.events} />
    </div>
  )
}

export function App() {
  const params = new URLSearchParams(window.location.search)
  if (params.get("window") === "overlay") {
    return <OverlayWindow />
  }
  return <RecorderPage />
}

export default App
