import { useState } from 'react'

import { DIGITS, type Digit, type Kind, type Label } from '../api/types'
import { useKeys } from '../hooks'
import { CellTile, labelText } from './CellTile'

export interface GalleryCell {
  id: string
  stem: string
  /** The kind the cell starts with. Only with `withKinds`. */
  kind?: Kind | null
  /** A short note on the tile, for example `62 %`. */
  note?: string
  title?: string | undefined
}

export interface Fix {
  digit?: Label
  kind?: Kind
}

export interface Confirmed {
  digit: Label
  kind: Kind | null
}

/** A tab is a digit, or `unknown` for cells that the model could not read. */
export type Tab = Digit | 'unknown'

interface Props {
  digit: Tab
  tabs?: readonly Tab[]
  counts: Partial<Record<Tab, number>>
  /** In the order to show: the cells most likely wrong first. */
  cells: GalleryCell[]
  onDigit: (digit: Tab) => void
  /** Every cell of the page with its label: the gallery digit, or the fix. */
  onConfirm: (labels: Record<string, Confirmed>) => void
  /** P, H and U set the kind of the marked cell. */
  withKinds?: boolean
  /** The cell under the pointer, or the marked cell. */
  onFocus?: (id: string | null) => void
  fixes?: Record<string, Fix>
  setFixes?: (update: (all: Record<string, Fix>) => Record<string, Fix>) => void
  busy?: boolean
}

export const GALLERY_KEYS = [
  { keys: 'Click', does: 'Mark a wrong cell' },
  { keys: '0–9', does: 'Give the marked cell its right digit (0 is empty)' },
  { keys: 'X', does: 'Discard the marked cell: a bad cut or an unreadable mark' },
  { keys: 'Enter', does: 'Confirm the page: the fixes, and the gallery digit for the rest' },
  { keys: '← →', does: 'Previous or next digit' },
]

export const KIND_KEYS = [{ keys: 'P H U', does: 'Printed, handwritten or unsure for the marked cell' }]

/** The first tab after `tab` that has cells, around the end. */
export function nextWithCells<T extends string>(
  tabs: readonly T[],
  tab: T,
  counts: Partial<Record<T, number>>,
): T | undefined {
  const at = tabs.indexOf(tab)
  return [...tabs.slice(at + 1), ...tabs.slice(0, at)].find((t) => (counts[t] ?? 0) > 0)
}

const NO_KIND = new Set<Label>(['empty', 'discarded'])
const keyDigit = (key: string): Digit => (key === '0' ? 'empty' : (key as Digit))
const isDigit = (tab: Tab): tab is Digit => tab !== 'unknown'

/** One gallery per digit: click the wrong cells, give each its right digit, confirm the rest. */
export function DigitGallery(props: Props) {
  const { digit, tabs = DIGITS, counts, cells, onDigit, onConfirm, withKinds = false, onFocus, busy = false } = props
  const [ownFixes, setOwnFixes] = useState<Record<string, Fix>>({})
  const fixes = props.fixes ?? ownFixes
  const setFixes = props.setFixes ?? setOwnFixes
  const [marked, setMarked] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [page, setPage] = useState('')
  const pageKey = `${digit}:${cells.map((c) => c.id).join(',')}`
  if (page !== pageKey) {
    // A new page clears the mark. The fixes stay: they are kept per cell.
    setPage(pageKey)
    setMarked(null)
    setWarning(null)
  }

  const result = (cell: GalleryCell): { digit: Label | null; kind: Kind | null } => {
    const fix = fixes[cell.id]
    const label = fix?.digit ?? (isDigit(digit) ? digit : null)
    const kind = label && NO_KIND.has(label) ? null : (fix?.kind ?? cell.kind ?? null)
    return { digit: label, kind }
  }

  const change = (update: Fix): void => {
    if (marked === null) {
      setWarning('Click a wrong cell first. Then type its digit.')
      return
    }
    setFixes((all) => {
      const next: Fix = { ...all[marked], ...update }
      if (next.digit === digit) delete next.digit
      const { [marked]: _, ...rest } = all
      return next.digit === undefined && next.kind === undefined ? rest : { ...rest, [marked]: next }
    })
    if (!withKinds) setMarked(null)
    setWarning(null)
  }

  const click = (id: string): void => {
    if (!withKinds && fixes[id] !== undefined) {
      setFixes(({ [id]: _, ...rest }) => rest)
      return
    }
    const next = marked === id ? null : id
    setMarked(next)
    onFocus?.(next)
  }

  const step = (by: number): void => {
    const at = tabs.indexOf(digit)
    onDigit(tabs[(at + by + tabs.length) % tabs.length]!)
  }

  const confirm = (): void => {
    if (busy || cells.length === 0) return
    if (marked !== null && fixes[marked] === undefined) {
      setWarning('One cell is marked without a fix. Type its digit, or click it again.')
      return
    }
    const results = cells.map((c) => [c.id, result(c)] as const)
    const noDigit = results.filter(([, r]) => r.digit === null).length
    if (noDigit) {
      setWarning(`${noDigit} cells have no digit yet. Click each one and type its digit.`)
      return
    }
    const noKind = withKinds ? results.filter(([, r]) => !NO_KIND.has(r.digit!) && !r.kind).length : 0
    if (noKind) {
      setWarning(`${noKind} cells have no kind yet. Click each one and press P or H.`)
      return
    }
    setMarked(null)
    onConfirm(Object.fromEntries(results.map(([id, r]) => [id, { digit: r.digit!, kind: r.kind }])))
  }

  useKeys({
    digit: (event) => change({ digit: keyDigit(event.key) }),
    x: () => change({ digit: 'discarded' }),
    ...(withKinds
      ? {
          p: () => change({ kind: 'printed' }),
          h: () => change({ kind: 'handwritten' }),
          u: () => change({ kind: 'unsure' }),
        }
      : {}),
    Enter: confirm,
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
  })

  const fixed = cells.filter((c) => fixes[c.id] !== undefined).length
  return (
    <>
      <nav className="digit-tabs" aria-label="Digits">
        {tabs
          .filter((d) => isDigit(d) || (counts[d] ?? 0) > 0)
          .map((d) => (
            <button
              key={d}
              type="button"
              className={d === digit ? 'here' : undefined}
              aria-current={d === digit ? 'page' : undefined}
              onClick={() => onDigit(d)}
            >
              <span className="digit">{d === 'empty' ? 'Empty' : d === 'unknown' ? 'No guess' : d}</span>
              <span className="count">{counts[d] ?? 0}</span>
            </button>
          ))}
      </nav>
      {warning ? (
        <p className="warning" role="alert">
          {warning}
        </p>
      ) : null}
      <div className="gallery" onMouseLeave={() => onFocus?.(marked)}>
        {cells.map((c) => {
          const r = result(c)
          const shown = fixes[c.id] !== undefined || withKinds ? labelText(r.digit, r.kind) : c.note
          return (
            <CellTile
              key={c.id}
              stem={c.stem}
              marked={marked === c.id}
              changed={fixes[c.id] !== undefined}
              label={shown}
              title={c.title}
              onClick={() => click(c.id)}
              onHover={onFocus ? () => onFocus(c.id) : undefined}
            />
          )
        })}
      </div>
      {cells.length ? (
        <footer className="actions">
          <span className="summary">
            {fixed ? `${fixed} fixed, ` : ''}
            {isDigit(digit)
              ? `${cells.length - fixed} stay ${digit === 'empty' ? 'empty' : digit}`
              : `${cells.length - fixed} without a digit`}
          </span>
          <button type="button" className="primary" onClick={confirm} disabled={busy}>
            Confirm {cells.length} cells <kbd>Enter</kbd>
          </button>
        </footer>
      ) : null}
    </>
  )
}
