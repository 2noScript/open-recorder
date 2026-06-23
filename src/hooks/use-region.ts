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

export function useRegion(screenWidth = 1920, screenHeight = 1080) {
  const [region, setRegion] = useState<Region>({
    x: Math.round(screenWidth * 0.15),
    y: Math.round(screenHeight * 0.15),
    width: Math.round(screenWidth * 0.7),
    height: Math.round(screenHeight * 0.7),
  })

  const dragRef = useRef<{
    handle: DragHandle
    startX: number
    startY: number
    startRegion: Region
  } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent, handle: DragHandle) => {
      e.preventDefault()
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRegion: { ...region },
      }

      function onMove(ev: PointerEvent) {
        if (!dragRef.current) return
        const { handle: h, startX, startY, startRegion: sr } = dragRef.current
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        let { x, y, width, height } = sr

        const MIN = 80

        switch (h) {
          case "move":
            x = sr.x + dx
            y = sr.y + dy
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
          case "bottom-right":
            width = sr.width + dx
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

        if (width < MIN) width = MIN
        if (height < MIN) height = MIN

        setRegion({ x, y, width, height })
      }

      function onUp() {
        dragRef.current = null
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [region]
  )

  return { region, setRegion, onPointerDown }
}
