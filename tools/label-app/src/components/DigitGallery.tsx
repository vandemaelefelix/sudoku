import { useState } from 'react'

import { DIGITS, type Digit, type Label } from '../api/types'
import { useKeys } from '../hooks'
import { CellTile, labelText } from './CellTile'

export interface GalleryCell {
  id: string
  stem: string
  /** A short reason on the tile, for example `62 %`. */
  note?: string
  title?: string
}

interface Props {
  digit: Digit
  counts: Partial<Record<Digit, number>>
  /** In the order to show: the cells most likely wrong first. */
  cells: GalleryCell[]
  onDigit: (digit: Digit) => void
  /** Every cell of the page with its label: the gallery digit, or the fix. */
  onConfirm: (labels: Record<string, Label>) => void
  busy?: boolean
}

export const GALLERY_KEYS = [
  { keys: 'Click', does: 'Mark a wrong cell' },
  { keys: '0–9', does: 'Give the marked cell its right digit (0 is empty)' },
  { keys: 'X', does: 'Discard the marked cell: a bad cut or an unreadable mark' },
  { keys: 'Enter', does: 'Confirm the page: the fixes, and the gallery digit for the rest' },
  { keys: '← →', does: 'Previous or next digit' },
]

const keyDigit = (key: string): Digit => (key === '0' ? 'empty' : (key as Digit))

/** One gallery per digit: click the wrong cells, give each its right digit, confirm the rest. */
export function DigitGallery({ digit, counts, cells, onDigit, onConfirm, busy = false }: Props) {
  const [fixes, setFixes] = useState<Record<string, Label>>({})
  const [marked, setMarked] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [page, setPage] = useState('')
  const pageKey = `${digit}:${cells.map((c) => c.id).join(',')}`
  if (page !== pageKey) {
    // A new page starts clean. This runs during render, before the old marks can show.
    setPage(pageKey)
    setFixes({})
    setMarked(null)
    setWarning(null)
  }

  const fix = (label: Label): void => {
    if (marked === null) {
      setWarning('Click a wrong cell first. Then type its digit.')
      return
    }
    setFixes((all) => {
      const next = { ...all }
      if (label === digit) delete next[marked]
      else next[marked] = label
      return next
    })
    setMarked(null)
    setWarning(null)
  }

  const click = (id: string): void => {
    if (fixes[id] !== undefined) {
      setFixes(({ [id]: _, ...rest }) => rest)
      return
    }
    setMarked(marked === id ? null : id)
  }

  const step = (by: number): void => {
    const at = DIGITS.indexOf(digit)
    onDigit(DIGITS[(at + by + DIGITS.length) % DIGITS.length]!)
  }

  const confirm = (): void => {
    if (busy || cells.length === 0) return
    if (marked !== null) {
      setWarning('One cell is marked without a digit. Type its digit, or click it again.')
      return
    }
    onConfirm(Object.fromEntries(cells.map((c) => [c.id, fixes[c.id] ?? digit])))
  }

  useKeys({
    digit: (event) => fix(keyDigit(event.key)),
    x: () => fix('discarded'),
    Enter: confirm,
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
  })

  const fixed = Object.keys(fixes).length
  return (
    <>
      <nav className="digit-tabs" aria-label="Digits">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={d === digit ? 'here' : undefined}
            aria-current={d === digit ? 'page' : undefined}
            onClick={() => onDigit(d)}
          >
            <span className="digit">{d === 'empty' ? 'Empty' : d}</span>
            <span className="count">{counts[d] ?? 0}</span>
          </button>
        ))}
      </nav>
      {warning ? (
        <p className="warning" role="alert">
          {warning}
        </p>
      ) : null}
      <div className="gallery">
        {cells.map((c) => (
          <CellTile
            key={c.id}
            stem={c.stem}
            marked={marked === c.id}
            changed={fixes[c.id] !== undefined}
            label={fixes[c.id] !== undefined ? labelText(fixes[c.id]!) : c.note}
            title={c.title}
            onClick={() => click(c.id)}
          />
        ))}
      </div>
      {cells.length ? (
        <footer className="actions">
          <span className="summary">
            {fixed ? `${fixed} fixed, ` : ''}
            {cells.length - fixed} stay {digit === 'empty' ? 'empty' : digit}
          </span>
          <button type="button" className="primary" onClick={confirm} disabled={busy}>
            Confirm {cells.length} cells <kbd>Enter</kbd>
          </button>
        </footer>
      ) : null}
    </>
  )
}
