import { useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface DragSelect {
  /** The props of the element that holds the tiles. Each tile has a `data-id`. */
  bind: { ref: RefObject<HTMLDivElement | null>; onMouseDown: (event: ReactMouseEvent) => void }
  /** The box of a drag in progress, in client pixels. */
  box: Box | null
  /** True once after a drag. A drag ends with a click on the tile under the pointer: that click must not toggle the tile. */
  wasDrag: () => boolean
}

/** Select the tiles inside a box that the person draws. Shift, ⌘ or Ctrl keep the cells that are selected already. */
export function useDragSelect(select: (ids: string[], add: boolean) => void): DragSelect {
  const galleryRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  const dragged = useRef(false)

  const onMouseDown = (event: ReactMouseEvent): void => {
    if (event.button !== 0) return
    const add = event.shiftKey || event.metaKey || event.ctrlKey
    const x0 = event.clientX
    const y0 = event.clientY
    let moving = false
    const move = (m: MouseEvent): void => {
      if (!moving && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return
      moving = true
      setBox({
        left: Math.min(x0, m.clientX),
        top: Math.min(y0, m.clientY),
        width: Math.abs(m.clientX - x0),
        height: Math.abs(m.clientY - y0),
      })
    }
    const up = (u: MouseEvent): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      if (!moving) return
      setBox(null)
      dragged.current = true
      window.setTimeout(() => (dragged.current = false), 0)
      const [l, r] = [Math.min(x0, u.clientX), Math.max(x0, u.clientX)]
      const [t, b] = [Math.min(y0, u.clientY), Math.max(y0, u.clientY)]
      const tiles = [...(galleryRef.current?.querySelectorAll<HTMLElement>('[data-id]') ?? [])]
      const hit = tiles.flatMap((el) => {
        const rect = el.getBoundingClientRect()
        const inside = rect.left <= r && rect.right >= l && rect.top <= b && rect.bottom >= t
        return inside && el.dataset.id !== undefined ? [el.dataset.id] : []
      })
      select(hit, add)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const wasDrag = (): boolean => {
    const was = dragged.current
    dragged.current = false
    return was
  }

  return { bind: { ref: galleryRef, onMouseDown }, box, wasDrag }
}
