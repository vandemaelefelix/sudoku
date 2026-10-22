import { cellImage, scanImage } from '../api/client'
import { DIGITS, type CheckCell, type Signal } from '../api/types'
import { labelText } from './CellTile'

export const percent = (p: number): string => `${Math.round(p * 100)} %`

const UNIT = { row: 'row', col: 'column', box: 'box' } as const
const KIND_NAMES = ['none', 'printed', 'handwritten', 'notes'] as const

const read = (what: string): string => (what === 'empty' ? 'an empty cell' : what)

/** One plain sentence per signal. The sudoku signals are hints and never block. */
export function signalText(s: Signal): string {
  switch (s.signal) {
    case 'low-p':
      return `The model gives the label only ${percent(s.p)}`
    case 'model-differs':
      return `The model reads ${read(s.predicted)} (${percent(s.p)}), not the label`
    case 'edited':
      return 'The player changed this label on the phone'
    case 'rule-break':
      return `Breaks ${UNIT[s.unit]} ${s.index + 1}: the digit shows twice`
    case 'not-unique':
      return 'The givens of this grid have more than one solution'
    case 'no-guess':
      return 'The model has no guess for this cell'
  }
}

function modelText(cell: CheckCell, mode: 'digits' | 'kinds'): string {
  if (!cell.probs) return 'No guess'
  const names: readonly string[] = mode === 'digits' ? DIGITS : KIND_NAMES
  const probs = mode === 'digits' ? cell.probs.digit : cell.probs.kind
  return probs
    .map((p, i) => ({ name: names[i] ?? '?', p }))
    .toSorted((a, b) => b.p - a.p)
    .slice(0, mode === 'digits' ? 3 : 4)
    .map(({ name, p }) => `${name === 'empty' ? 'empty' : name} ${percent(p)}`)
    .join(', ')
}

interface Props {
  cell: CheckCell
  mode: 'digits' | 'kinds'
  /** The fix of the person as shown on a tile, or undefined. */
  fix: string | undefined
}

/** The cell in its sudoku, with the label, the model, the doubt and the source. */
export function CellDetail({ cell, mode, fix }: Props) {
  const label = mode === 'digits' ? labelText(cell.digit) : (cell.kind ?? 'none yet')
  const from =
    cell.source === 'loose'
      ? 'A loose cell: no scan holds it'
      : `${cell.source === 'app' ? 'Uploaded scan' : 'Imported photo'} ${cell.photo ?? ''}${
          cell.row === null || cell.col === null ? '' : `, row ${cell.row + 1}, column ${cell.col + 1}`
        }`
  return (
    <aside className="detail" aria-label="The cell in its sudoku">
      {cell.photo && cell.row !== null && cell.col !== null ? (
        <figure className="detail-grid">
          <img src={scanImage(cell.photo)} alt={`The sudoku of ${cell.photo}`} />
          <span
            className="detail-mark"
            style={{ left: `${(cell.col * 100) / 9}%`, top: `${(cell.row * 100) / 9}%` }}
            aria-hidden="true"
          />
        </figure>
      ) : (
        <p className="detail-nophoto">No photo: a loose cell</p>
      )}
      <div className="detail-cell">
        <img src={cellImage(cell.stem)} alt="The cell, large" width={128} height={128} />
        <dl>
          <dt>Label</dt>
          <dd>{mode === 'kinds' ? `${label}, digit ${cell.digit ?? '?'}` : label}</dd>
          <dt>Model</dt>
          <dd>{modelText(cell, mode)}</dd>
          {fix ? (
            <>
              <dt>Your fix</dt>
              <dd className="detail-fix">{fix}</dd>
            </>
          ) : null}
          <dt>From</dt>
          <dd>{from}</dd>
        </dl>
      </div>
      <div className="detail-doubt">
        <h3>Doubt {percent(cell.doubt)}</h3>
        {cell.reasons.length ? (
          <ul>
            {cell.reasons.map((r) => (
              <li key={signalText(r)}>{signalText(r)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No signal doubts this label.</p>
        )}
      </div>
    </aside>
  )
}
