import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { flatImage, get, photoImage, post } from '../api/client'
import type { Corners, FixResult, Outline } from '../api/types'
import { Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'
import { fixQueue, nextToFix } from './Outlines'

const CORNER_NAMES = ['top left', 'top right', 'bottom right', 'bottom left']
const PREVIEW_DELAY = 250 // ms after the last move, so a drag does not cut the photo on every frame

/** A first outline when the detection found none: the middle 80 % of the photo. */
function inset(width: number, height: number): Corners {
  const [x0, y0, x1, y1] = [width * 0.1, height * 0.1, width * 0.9, height * 0.9]
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

/** The same quadrilateral, turned a quarter: the digits stand upright after a sideways cut. */
const turn = (c: Corners): Corners => [c[3], c[0], c[1], c[2]]

const round1 = (c: Corners): Corners => c.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) as Corners

export function OutlineLarge({ photo }: { photo: string }) {
  const one = useLoad(() => get<Outline>(`/api/outline?photo=${photo}`), photo)
  const [corners, setCorners] = useState<Corners | null>(null)
  const [preview, setPreview] = useState<Corners | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const action = useAction(one.reload)
  const data = one.data?.photo === photo ? one.data : undefined

  const [shown, setShown] = useState<string>('')
  if (data && shown !== photo) {
    setShown(photo)
    const start = data.corners ?? inset(data.width, data.height)
    setCorners(start)
    setPreview(start)
  }

  useEffect(() => {
    if (!corners || dragging !== null) return undefined
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
    if (dragging === null || !corners || !data) return
    const at = toPhoto(event)
    if (!at) return
    const clamped: [number, number] = [
      Math.min(Math.max(at[0], 0), data.width),
      Math.min(Math.max(at[1], 0), data.height),
    ]
    setCorners(corners.map((c, n) => (n === dragging ? clamped : c)) as Corners)
  }

  const save = async (): Promise<void> => {
    if (!corners) return
    const result = await action.run(
      () => post<FixResult>('/api/outlines/fix', { photo, corners: round1(corners) }),
      (r) => `Saved the corners of ${photo} and cut ${r.cells} new cells.`,
    )
    if (result) nextToFix(`Saved the corners of ${photo}. Next: Cells per digit.`)
  }

  const reject = async (): Promise<void> => {
    const result = await action.run(
      () => post<number>('/api/outlines/reject', { photo }),
      () => 'Rejected the scan. Its cells never train.',
    )
    if (result !== undefined) nextToFix(`Rejected ${photo}. Its cells never train.`)
  }

  useKeys({
    Enter: save,
    r: reject,
    t: () => corners && setCorners(turn(corners)),
    z: action.undo,
    Escape: () => {
      fixQueue.length = 0
      go('outlines')
    },
  })

  const waiting = fixQueue.length
  return (
    <Frame
      step="outlines"
      task="Drag the 4 corners onto the outer corners of the grid. Enter cuts the 81 cells again. R rejects the photo."
      keys={[
        { keys: 'Drag', does: 'Move a corner' },
        { keys: 'Enter', does: 'Save the corners and cut the cells again' },
        { keys: 'T', does: 'Turn the grid a quarter: for sideways digits' },
        { keys: 'R', does: 'Reject the photo: its cells never train' },
        { keys: 'Esc', does: 'Back to the gallery. The outline stays unchecked' },
      ]}
      note={action.note ?? (waiting ? `${waiting} more marked after this one.` : undefined)}
      action={
        data ? (
          <>
            <button type="button" onClick={reject} disabled={action.busy}>
              Reject <kbd>R</kbd>
            </button>
            <button type="button" className="primary" onClick={save} disabled={action.busy}>
              Save the corners <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      {one.error ? <Failure message={one.error} retry={one.reload} /> : null}
      {!data && !one.error ? <Working what="Opening the photo…" /> : null}
      {data && corners ? (
        <div className="large">
          <svg
            ref={svg}
            className="photo-view"
            viewBox={`0 0 ${data.width} ${data.height}`}
            onPointerMove={move}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
            role="img"
            aria-label="The photo with its outline"
          >
            <image href={photoImage(photo)} width={data.width} height={data.height} />
            <polygon className="quad" points={corners.map((c) => c.join(',')).join(' ')} />
            {corners.map(([x, y], n) => (
              <circle
                key={CORNER_NAMES[n]}
                className={`handle${n === 0 ? ' first' : ''}`}
                cx={x}
                cy={y}
                r={Math.max(data.width, data.height) / 70}
                onPointerDown={(event) => {
                  event.currentTarget.ownerSVGElement?.setPointerCapture?.(event.pointerId)
                  setDragging(n)
                }}
              />
            ))}
          </svg>
          <figure className="flat">
            {preview ? <img src={flatImage(photo, preview)} alt="The cut of these corners" /> : null}
            <figcaption>The cut of these corners. The top left corner has the filled handle.</figcaption>
          </figure>
        </div>
      ) : null}
    </Frame>
  )
}
