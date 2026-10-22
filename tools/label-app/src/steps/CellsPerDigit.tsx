import { useEffect, useState } from 'react'

import { cellImage, get, post, scanImage } from '../api/client'
import { DIGITS, type CheckCell, type CheckPage } from '../api/types'
import { KIND_LETTER, labelText } from '../components/CellTile'
import {
  DigitGallery,
  GALLERY_KEYS,
  KIND_KEYS,
  nextWithCells,
  type Confirmed,
  type Fix,
  type Tab,
} from '../components/DigitGallery'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

const TABS: readonly Tab[] = [...DIGITS, 'unknown']
const isTab = (value: string | undefined): value is Tab => TABS.includes(value as Tab)
const percent = (p: number): string => `${Math.round(p * 100)} %`

/** Flow A step 3: the cells of the approved scans per digit, with the scan of the cell beside them. */
export function CellsPerDigit({ digit: asked }: { digit: string | undefined }) {
  const digit: Tab = isTab(asked) ? asked : 'empty'
  const [round, setRound] = useState(0)
  const page = useLoad(() => get<CheckPage>(`/api/cells?digit=${digit}`), `${digit}:${round}`)
  const action = useAction(() => setRound((n) => n + 1))
  const [fixes, setFixes] = useState<Record<string, Fix>>({})
  const [focus, setFocus] = useState<string | null>(null)
  const data = page.data?.digit === digit ? page.data : undefined
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0
  // Without a digit in the route, or when this digit has no cell left, open the next digit with cells.
  const next = data && data.counts[digit] === 0 ? nextWithCells(TABS, digit, data.counts) : undefined
  const first = page.data ? TABS.find((d) => page.data!.counts[d] > 0) : undefined
  useEffect(() => {
    if (!isTab(asked) && first && first !== digit) go(`a/cells/${first}`)
    else if (next) go(`a/cells/${next}`)
  }, [asked, first, digit, next])

  const confirm = async (labels: Record<string, Confirmed>): Promise<void> => {
    const cells = Object.entries(labels).map(([id, label]) => ({ id, ...label }))
    const fixed = cells.filter((c) => fixes[c.id] !== undefined).length
    const done = await action.run(
      () => post<number>('/api/cells/verify', { cells }),
      () => `Confirmed ${cells.length} cells${fixed ? `, ${fixed} with a fix` : ''}.`,
    )
    if (done !== undefined) {
      setFixes((all) => Object.fromEntries(Object.entries(all).filter(([id]) => !(id in labels))))
      setFocus(null)
    }
    setRound((n) => n + 1)
  }

  useKeys({ z: action.undo, Escape: () => go('') })

  const shown = data?.cells.find((c) => c.id === focus) ?? data?.cells[0]
  return (
    <Frame
      flow="a"
      step="cells"
      task="Click each cell that is not this digit and type its right digit. Point at a cell to see its sudoku. Enter confirms the rest."
      keys={[...GALLERY_KEYS, ...KIND_KEYS]}
      note={action.note}
    >
      {page.error ? <Failure message={page.error} retry={page.reload} /> : null}
      {!data && !page.error ? <Working what="Loading the cells…" /> : null}
      {data && total === 0 ? (
        <Empty
          why="No cell of an approved scan waits for a check."
          next={
            <button type="button" className="primary" onClick={() => go('a/finish')}>
              Next: Finish
            </button>
          }
        />
      ) : null}
      {data && total > 0 ? (
        <div className="check">
          <div className="check-cells">
            <DigitGallery
              digit={digit}
              tabs={TABS}
              counts={data.counts}
              cells={data.cells.map((c) => ({
                id: c.id,
                stem: c.stem,
                kind: c.kind,
                title: c.edited ? 'The player corrected this cell' : undefined,
              }))}
              onDigit={(d) => go(`a/cells/${d}`)}
              onConfirm={confirm}
              withKinds
              onFocus={setFocus}
              fixes={fixes}
              setFixes={setFixes}
              busy={action.busy}
            />
          </div>
          {shown ? <CellDetail cell={shown} fix={fixes[shown.id]} /> : null}
        </div>
      ) : null}
    </Frame>
  )
}

function CellDetail({ cell, fix }: { cell: CheckCell; fix: Fix | undefined }) {
  const label = labelText(cell.digit, cell.kind)
  const from = cell.source === 'app' ? 'Uploaded scan' : 'Imported photo'
  return (
    <aside className="detail" aria-label="The cell in its sudoku">
      <figure className="detail-grid">
        <img src={scanImage(cell.photo)} alt={`The sudoku of ${cell.photo}`} />
        <span
          className="detail-mark"
          style={{ left: `${(cell.col * 100) / 9}%`, top: `${(cell.row * 100) / 9}%` }}
          aria-hidden="true"
        />
      </figure>
      <div className="detail-cell">
        <img src={cellImage(cell.stem)} alt="The cell, large" width={128} height={128} />
        <dl>
          <dt>Label</dt>
          <dd>
            {cell.digit === null ? 'None yet' : cell.digit === 'empty' ? 'empty' : label}
            {cell.source === 'app'
              ? cell.edited
                ? ', corrected by the player'
                : ', kept by the player'
              : ', the model’s guess'}
          </dd>
          <dt>Model</dt>
          <dd>
            {cell.model
              ? `${cell.model.digit === 'empty' ? 'empty' : cell.model.digit}${cell.model.kind in KIND_LETTER ? ` ${KIND_LETTER[cell.model.kind as keyof typeof KIND_LETTER]}` : ''}, ${percent(cell.model.p)}`
              : 'No guess'}
          </dd>
          {fix ? (
            <>
              <dt>Your fix</dt>
              <dd className="detail-fix">{labelText(fix.digit ?? cell.digit, fix.kind ?? cell.kind)}</dd>
            </>
          ) : null}
          <dt>From</dt>
          <dd>
            {from} {cell.photo}, row {cell.row + 1}, column {cell.col + 1}
          </dd>
        </dl>
      </div>
    </aside>
  )
}
