import { useCallback, useRef, useState } from "react"

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

type DragHandle =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "move"
  | "create"

const MIN = 80

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function useRegion(screenWidth = 1920, screenHeight = 1080) {
  const [region, setRegion] = useState<Region | null>(null)

  const dragRef = useRef<{
    handle: DragHandle
    startX: number
    startY: number
    startRegion: Region
  } | null>(null)

  const compute = useCallback(
    (h: DragHandle, dx: number, dy: number, sr: Region) => {
      let { x, y, width, height } = sr

      switch (h) {
        case "move":
          x = sr.x + dx
          y = sr.y + dy
          break
        case "create":
        case "bottom-right":
          width = sr.width + dx
          height = sr.height + dy
          break
        case "top-left":
          x = sr.x + dx
          y = sr.y + dy
          width = sr.width - dx
          height = sr.height - dy
          break
        case "top-right":
          y = sr.y + dy
          width = sr.width + dx
          height = sr.height - dy
          break
        case "bottom-left":
          x = sr.x + dx
          width = sr.width - dx
          height = sr.height + dy
          break
        case "top":
          y = sr.y + dy
          height = sr.height - dy
          break
        case "bottom":
          height = sr.height + dy
          break
        case "left":
          x = sr.x + dx
          width = sr.width - dx
          break
        case "right":
          width = sr.width + dx
          break
      }

      if (width < 0) {
        x = x + width
        width = -width
      }
      if (height < 0) {
        y = y + height
        height = -height
      }

      width = clamp(width, MIN, screenWidth)
      height = clamp(height, MIN, screenHeight)
      x = clamp(x, 0, screenWidth - width)
      y = clamp(y, 0, screenHeight - height)

      return { x, y, width, height }
    },
    [screenWidth, screenHeight]
  )

  const onPointerDownCreate = useCallback(
    (e: React.PointerEvent) => {
      const startX = e.clientX
      const startY = e.clientY
      const sr = { x: startX, y: startY, width: 0, height: 0 }
      const r = compute("create", 0, 0, sr)
      setRegion(r)
      dragRef.current = { handle: "create", startX, startY, startRegion: sr }

      function onMove(ev: PointerEvent) {
        if (!dragRef.current) return
        const { handle: h, startX: sx, startY: sy, startRegion } = dragRef.current
        const dx = ev.clientX - sx
        const dy = ev.clientY - sy
        setRegion(compute(h, dx, dy, startRegion))
      }

      function onUp() {
        dragRef.current = null
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [compute]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent, handle: DragHandle) => {
      e.preventDefault()
      if (!region) return
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRegion: { ...region },
      }

      function onMove(ev: PointerEvent) {
        if (!dragRef.current) return
        const { handle: h, startX: sx, startY: sy, startRegion } = dragRef.current
        const dx = ev.clientX - sx
        const dy = ev.clientY - sy
        setRegion(compute(h, dx, dy, startRegion))
      }

      function onUp() {
        dragRef.current = null
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [region, compute]
  )

  const reset = useCallback(() => {
    setRegion(null)
  }, [])

  return { region, setRegion, onPointerDown, onPointerDownCreate, reset }
}
