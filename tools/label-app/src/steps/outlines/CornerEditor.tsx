import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { flatImage, photoImage } from '../../api/client'
import type { Corners } from '../../api/types'
import { CORNER_NAMES, moveCorner } from './geometry'

const PREVIEW_DELAY = 250 // ms after the last move, so a drag does not cut the photo on every frame

interface Props {
  photo: string
  width: number
  height: number
  corners: Corners
  onChange: (corners: Corners) => void
}

/** The photo with four corner handles, and the flat cut of the corners next to it. */
export function CornerEditor({ photo, width, height, corners, onChange }: Props) {
  const [preview, setPreview] = useState<Corners>(corners)
  const [dragging, setDragging] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (dragging !== null) return undefined
    const timer = setTimeout(() => setPreview(corners), PREVIEW_DELAY)
    return () => clearTimeout(timer)
  }, [corners, dragging])

  const toPhoto = (event: PointerEvent): [number, number] | null => {
    const matrix = svg.current?.getScreenCTM()
    if (!svg.current || !matrix) return null
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return [point.x, point.y]
  }

  const move = (event: PointerEvent): void => {
    if (dragging === null) return
    const at = toPhoto(event)
    if (at) onChange(moveCorner(corners, dragging, at, width, height))
  }

  return (
    <div className="large">
      <svg
        ref={svg}
        className="photo-view"
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={move}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
        role="img"
        aria-label="The photo with its outline"
      >
        <image href={photoImage(photo)} width={width} height={height} />
        <polygon className="quad" points={corners.map((c) => c.join(',')).join(' ')} />
        {corners.map(([x, y], n) => (
          <circle
            key={CORNER_NAMES[n]}
            className={`handle${n === 0 ? ' first' : ''}`}
            cx={x}
            cy={y}
            r={Math.max(width, height) / 70}
            onPointerDown={(event) => {
              event.currentTarget.ownerSVGElement?.setPointerCapture?.(event.pointerId)
              setDragging(n)
            }}
          />
        ))}
      </svg>
      <figure className="flat">
        <img src={flatImage(photo, preview)} alt="The cut of these corners" />
        <figcaption>The cut of these corners. The top left corner has the filled handle.</figcaption>
      </figure>
    </div>
  )
}
