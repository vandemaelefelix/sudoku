import { useState } from 'react'

import { get, outlineImage, post } from '../api/client'
import type { OutlinePage } from '../api/types'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

/** The marked outlines that wait for the large view, in gallery order. The large view takes the next one. */
export const fixQueue: string[] = []

let carried: string | undefined

function takeCarried(): string | undefined {
  const note = carried
  carried = undefined
  return note
}

/** Open the next marked outline, or the gallery with `note` when none is left. */
export function nextToFix(note?: string): void {
  const next = fixQueue.shift()
  if (!next) carried = note
  go(next ? `a/outlines/${next}` : 'a/outlines')
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

export function Outlines() {
  const [round, setRound] = useState(0)
  const page = useLoad(() => get<OutlinePage>('/api/outlines'), `outlines:${round}`)
  const action = useAction(() => setRound((n) => n + 1))
  const [arrived] = useState(takeCarried)
  const [marks, setMarks] = useState<Set<string>>(new Set())
  const scans = page.data?.scans ?? []
  // A photo without a detected outline cannot be approved: it always opens large.
  const blind = new Set(scans.filter((s) => s.corners === null).map((s) => s.photo))
  const marked = scans.filter((s) => marks.has(s.photo) || blind.has(s.photo)).map((s) => s.photo)
  const good = scans.filter((s) => !marked.includes(s.photo)).map((s) => s.photo)

  const toggle = (photo: string): void => {
    if (blind.has(photo)) return
    setMarks((all) => {
      const next = new Set(all)
      if (next.has(photo)) next.delete(photo)
      else next.add(photo)
      return next
    })
  }

  const approve = async (): Promise<void> => {
    if (!scans.length || action.busy) return
    if (good.length) {
      const done = await action.run(
        () => post<number>('/api/outlines/approve', { photos: good }),
        (n) =>
          `Approved ${plural(n, 'outline')}.` +
          (marked.length ? ` Next: fix the ${plural(marked.length, 'marked one')}.` : ''),
      )
      if (done === undefined) return
    }
    setMarks(new Set())
    if (marked.length) {
      fixQueue.splice(0, fixQueue.length, ...marked)
      nextToFix()
    } else {
      setRound((n) => n + 1)
    }
  }

  useKeys({ Enter: approve, z: action.undo, Escape: () => go('') })

  const open = page.data?.open ?? 0
  return (
    <Frame
      flow="a"
      step="outlines"
      task="Click each outline that does not follow the grid. Enter approves the rest, then opens each marked one."
      keys={[
        { keys: 'Click', does: 'Mark a bad outline, or unmark it' },
        { keys: 'Enter', does: 'Approve the unmarked outlines, then fix the marked ones' },
      ]}
      note={action.note ?? arrived}
      action={
        scans.length ? (
          <>
            <span className="summary">
              {open > scans.length
                ? `${scans.length} of ${open} shown, the most doubtful first`
                : `${open} to check, the most doubtful first`}
            </span>
            <button type="button" className="primary" onClick={approve} disabled={action.busy}>
              {good.length ? `Approve ${plural(good.length, 'outline')}` : 'Fix the marked ones'}
              {good.length && marked.length ? `, then fix ${marked.length}` : ''} <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      {page.error ? <Failure message={page.error} retry={page.reload} /> : null}
      {page.loading && !page.data ? <Working what="Scoring the outlines. A new photo takes a moment…" /> : null}
      {page.data && !scans.length ? (
        <Empty
          why="Every outline is checked."
          next={
            <button type="button" className="primary" onClick={() => go('a/cells')}>
              Next: Cells per scan
            </button>
          }
        />
      ) : null}
      <div className="outline-grid">
        {scans.map((s) => (
          <button
            key={s.photo}
            type="button"
            className={`outline-tile${marked.includes(s.photo) ? ' marked' : ''}`}
            aria-pressed={marked.includes(s.photo)}
            onClick={() => toggle(s.photo)}
            title={s.corners ? `Grid fit ${s.fit.toFixed(2)}` : 'No outline found: set the corners in the large view'}
          >
            <img src={outlineImage(s.photo, round)} alt={`Scan ${s.photo}`} loading="lazy" />
            <span className="tile-tags">
              <span className="tag">{s.source === 'app' ? 'Scan' : 'Photo'}</span>
              {s.corners ? null : <span className="tag warn">No outline</span>}
            </span>
          </button>
        ))}
      </div>
    </Frame>
  )
}
