import { Button } from "@/components/ui/button"
import {
  PencilIcon,
  HighlighterIcon,
  EraserIcon,
  Undo2Icon,
  MinusIcon,
} from "lucide-react"

export type AnnotationMode = "none" | "draw" | "highlight" | "line" | "eraser"

interface AnnotationToolsProps {
  mode: AnnotationMode
  onChange: (mode: AnnotationMode) => void
  onUndo: () => void
  canUndo: boolean
}

const TOOLS: Array<{
  mode: AnnotationMode
  icon: typeof PencilIcon
  label: string
}> = [
  { mode: "draw", icon: PencilIcon, label: "Draw" },
  { mode: "highlight", icon: HighlighterIcon, label: "Highlight" },
  { mode: "line", icon: MinusIcon, label: "Line" },
  { mode: "eraser", icon: EraserIcon, label: "Eraser" },
]

export function AnnotationTools({
  mode,
  onChange,
  onUndo,
  canUndo,
}: AnnotationToolsProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background p-1 shadow-lg">
      <div className="flex items-center gap-0.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Button
              key={tool.mode}
              variant={mode === tool.mode ? "default" : "ghost"}
              size="icon-sm"
              onClick={() =>
                onChange(mode === tool.mode ? "none" : tool.mode)
              }
              title={tool.label}
            >
              <Icon className="size-4" />
            </Button>
          )
        })}
      </div>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
      >
        <Undo2Icon className="size-4" />
      </Button>
    </div>
  )
}
