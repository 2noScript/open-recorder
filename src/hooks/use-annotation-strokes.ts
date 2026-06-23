import { useCallback, useRef, useState } from "react"
import type { AnnotationMode } from "@/components/recorder/annotation-tools"

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: number
  mode: Exclude<AnnotationMode, "none">
  points: Point[]
  color: string
  width: number
}

export function useAnnotationStrokes() {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const idRef = useRef(0)

  const startStroke = useCallback((mode: Stroke["mode"], point: Point, color: string, width: number) => {
    const id = ++idRef.current
    const stroke: Stroke = { id, mode, points: [point], color, width }
    currentRef.current = stroke
    setStrokes((prev) => [...prev, stroke])
  }, [])

  const addPoint = useCallback((point: Point) => {
    const current = currentRef.current
    if (!current) return
    current.points.push(point)
    setStrokes((prev) => {
      const copy = [...prev]
      const idx = copy.findIndex((s) => s.id === current.id)
      if (idx !== -1) copy[idx] = { ...current }
      return copy
    })
  }, [])

  const endStroke = useCallback(() => {
    const current = currentRef.current
    if (current && current.points.length < 2) {
      setStrokes((prev) => prev.filter((s) => s.id !== current.id))
    }
    currentRef.current = null
  }, [])

  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    setStrokes([])
  }, [])

  return { strokes, startStroke, addPoint, endStroke, undo, clear }
}

export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
) {
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue

    ctx.save()

    switch (stroke.mode) {
      case "draw":
      case "line":
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.beginPath()
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          if (stroke.mode === "line") {
            ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y)
            break
          }
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.stroke()
        break

      case "highlight":
        ctx.strokeStyle = "rgba(255, 255, 0, 0.4)"
        ctx.lineWidth = 24
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.beginPath()
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.stroke()
        break

      case "eraser":
        ctx.clearRect(
          stroke.points[0].x - 10,
          stroke.points[0].y - 10,
          20,
          20
        )
        break
    }

    ctx.restore()
  }
}
