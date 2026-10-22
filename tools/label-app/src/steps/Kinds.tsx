import { useState } from 'react'

import { get, post } from '../api/client'
import type { Kind, KindPage } from '../api/types'
import { CellTile, KIND_LETTER } from '../components/CellTile'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

const OTHER: Record<Kind, Kind> = { printed: 'handwritten', handwritten: 'printed', unsure: 'printed' }
const GUESS: Record<string, string> = {
  printed: 'The model reads these cells as printed.',
  handwritten: 'The model reads these cells as handwritten.',
  other: 'The model sees no clear printed or handwritten digit here.',
}

/** Flow B step 3: a page of cells of one digit without a kind. P or H sets the page, a click flips one cell. */
export function Kinds() {
  const [after, setAfter] = useState('')
  const [round, setRound] = useState(0)
  const page = useLoad(() => get<KindPage | null>(`/api/kinds${after}`), `${after}:${round}`)
  const action = useAction(() => setRound((n) => n + 1))
  const data = page.data
  const [pageKind, setPageKind] = useState<Kind | null>(null)
  const [flips, setFlips] = useState<Record<string, Kind>>({})
  const [last, setLast] = useState<string | null>(null)
  const [shown, setShown] = useState<KindPage | null | undefined>()
  if (data !== shown) {
    setShown(data)
    setFlips({})
    setLast(null)
    const starts = new Set(data?.cells.map((c) => c.start))
    setPageKind(starts.size === 1 ? ([...starts][0] ?? null) : null)
  }

  const kindOf = (id: string, start: Kind | null): Kind | null => flips[id] ?? pageKind ?? start
  const flip = (id: string, start: Kind | null): void => {
    const now = kindOf(id, start)
    setLast(id)
    setFlips((all) => ({ ...all, [id]: now ? OTHER[now] : 'printed' }))
  }
  const setAll = (kind: Kind): void => {
    setPageKind(kind)
    setFlips({})
  }

  const save = async (): Promise<void> => {
    if (!data || action.busy) return
    const cells = data.cells.map((c) => ({ id: c.id, kind: kindOf(c.id, c.start) }))
    const open = cells.filter((c) => !c.kind).length
    if (open) {
      action.setNote(`${open} cells have no kind yet. Press P or H for the page first.`)
      return
    }
    const done = await action.run(
      () => post<number>('/api/kinds/save', { cells }),
      () => `Saved the kinds of ${cells.length} cells.`,
    )
    if (done !== undefined) setAfter(`?folder=${data.folder}&group=${data.group}&page=${data.page}`)
  }

  useKeys({
    p: () => setAll('printed'),
    h: () => setAll('handwritten'),
    u: () => last && setFlips((all) => ({ ...all, [last]: 'unsure' })),
    Enter: save,
    z: action.undo,
    Escape: () => go(''),
  })

  const flipped = data ? data.cells.filter((c) => flips[c.id] !== undefined).length : 0
  return (
    <Frame
      flow="b"
      step="kinds"
      task="Press P or H for the kind of most cells. Click each cell that differs. Enter saves the page."
      keys={[
        { keys: 'P / H', does: 'Printed or handwritten for the whole page' },
        { keys: 'Click', does: 'Flip one cell to the other kind' },
        { keys: 'U', does: 'Unsure for the last clicked cell: training ignores its kind' },
        { keys: 'Enter', does: 'Save the page and open the next one' },
      ]}
      note={action.note}
      action={
        data ? (
          <>
            <span className="summary">
              Digit {data.folder}: {data.progress.labelled} of {data.progress.cells} have a kind
              {flipped ? `, ${flipped} flipped` : ''}
            </span>
            <button type="button" className="primary" onClick={save} disabled={action.busy}>
              Save {data.cells.length} kinds <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      {page.error ? <Failure message={page.error} retry={page.reload} /> : null}
      {page.loading && data === undefined ? <Working what="Loading the cells…" /> : null}
      {data === null ? (
        <Empty
          why="Every digit cell has a kind."
          next={
            <button type="button" className="primary" onClick={() => go('b/doubtful')}>
              Next: Doubtful labels
            </button>
          }
        />
      ) : null}
      {data ? (
        <>
          <p className="muted">
            {data.predicted ? GUESS[data.predicted] : 'Cells of one group look alike.'}{' '}
            {pageKind ? `The page is ${pageKind}.` : 'The page has no kind yet.'}
          </p>
          <div className="gallery">
            {data.cells.map((c) => {
              const kind = kindOf(c.id, c.start)
              return (
                <CellTile
                  key={c.id}
                  stem={c.stem}
                  label={kind ? KIND_LETTER[kind] : '?'}
                  changed={flips[c.id] !== undefined}
                  marked={last === c.id}
                  onClick={() => flip(c.id, c.start)}
                />
              )
            })}
          </div>
        </>
      ) : null}
    </Frame>
  )
}
