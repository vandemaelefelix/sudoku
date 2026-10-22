import { useEffect, useState } from 'react'

import { get, photoImage, post } from '../api/client'
import type { Digit, Kind, Scan, ScanCell, ScanSummary } from '../api/types'
import { CellTile, labelText } from '../components/CellTile'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

interface Entry {
  digit: Digit | null
  kind: Kind | null
}

const isCell = (place: Scan['cells'][number]): place is ScanCell => 'id' in place
const own = (cell: ScanCell): boolean => !cell.shared && !cell.locked

/** The feedback of the last confirm, for the scan that opens after it. */
let confirmed: string | undefined

function carry(note: string): void {
  confirmed = note
}

function takeCarried(): string | undefined {
  const note = confirmed
  confirmed = undefined
  return note
}

/** Flow A step 3: one scan at a time. Without `photo`, the first scan that waits opens. */
export function Cells({ photo }: { photo: string | undefined }) {
  const list = useLoad(() => get<{ scans: ScanSummary[] }>('/api/scans'), `scans:${photo ?? ''}`)
  const first = list.data?.scans[0]?.photo
  useEffect(() => {
    if (!photo && first) go(`a/cells/${first}`)
  }, [photo, first])
  if (!photo) {
    return (
      <Frame flow="a" step="cells" task="Check the cells of each scan." keys={[]}>
        {list.error ? <Failure message={list.error} retry={list.reload} /> : null}
        {list.data && !first ? (
          <Empty
            why="No approved scan waits for its cells."
            next={
              <button type="button" className="primary" onClick={() => go('a/finish')}>
                Next: Finish
              </button>
            }
          />
        ) : (
          <Working what="Finding the next scan…" />
        )}
      </Frame>
    )
  }
  return <ScanCells key={photo} photo={photo} scans={list.data?.scans ?? []} />
}

function ScanCells({ photo, scans }: { photo: string; scans: ScanSummary[] }) {
  const scan = useLoad(() => get<Scan>(`/api/scan?photo=${photo}`), photo)
  const action = useAction(scan.reload)
  const [arrived] = useState(takeCarried)
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [at, setAt] = useState(0)
  const cells = scan.data?.cells ?? []
  const [loaded, setLoaded] = useState<Scan | undefined>()
  if (scan.data && scan.data !== loaded) {
    setLoaded(scan.data)
    setEntries(Object.fromEntries(cells.filter(isCell).map((c) => [c.id, { digit: c.digit, kind: c.kind }])))
  }

  const place = cells[at]
  const selected = place && isCell(place) && own(place) ? place : undefined
  const change = (update: Partial<Entry>): void => {
    if (!selected) return
    setEntries((all) => {
      const old = all[selected.id] ?? { digit: null, kind: null }
      const next = { ...old, ...update }
      if (next.digit === 'empty') next.kind = null
      else if (next.digit && !next.kind) next.kind = selected.kind ?? 'printed'
      return { ...all, [selected.id]: next }
    })
  }
  const moveBy = (by: number): void => setAt((n) => Math.min(80, Math.max(0, n + by)))

  const mine = cells.filter(isCell).filter(own)
  const without = mine.filter((c) => !entries[c.id]?.digit)
  const confirm = async (): Promise<void> => {
    if (!mine.length || action.busy) return
    if (without.length) {
      action.setNote(`${without.length} cells have no digit yet. Select each one and type its digit.`)
      return
    }
    const body = mine.map((c) => ({ id: c.id, digit: entries[c.id]!.digit, kind: entries[c.id]!.kind }))
    const done = await action.run(
      () => post<number>('/api/scans/confirm', { photo, cells: body }),
      () => undefined,
    )
    if (done !== undefined) {
      const next = scans.find((s) => s.photo !== photo)
      carry(`Confirmed the ${mine.length} cells of ${photo}.` + (next ? ' This is the next scan.' : ''))
      go(next ? `a/cells/${next.photo}` : 'a/cells')
    }
  }

  useKeys({
    digit: (event) => change({ digit: event.key === '0' ? 'empty' : (event.key as Digit) }),
    p: () => change({ kind: 'printed' }),
    h: () => change({ kind: 'handwritten' }),
    u: () => change({ kind: 'unsure' }),
    ArrowLeft: () => moveBy(-1),
    ArrowRight: () => moveBy(1),
    ArrowUp: () => moveBy(-9),
    ArrowDown: () => moveBy(9),
    Tab: (event) => moveBy(event.shiftKey ? -1 : 1),
    Enter: confirm,
    z: action.undo,
    Escape: () => go(''),
  })

  const data = scan.data
  const fixed = mine.filter((c) => entries[c.id]?.digit !== c.digit || entries[c.id]?.kind !== c.kind).length
  const source = data?.source === 'photo' ? 'the model reads' : 'the player confirmed'
  return (
    <Frame
      flow="a"
      step="cells"
      task={`Each cell shows the digit and kind that ${source}. Fix the wrong ones, then press Enter.`}
      keys={[
        { keys: 'Click, arrows', does: 'Select a cell' },
        { keys: '0–9', does: 'Give the selected cell its digit (0 is empty)' },
        { keys: 'P H U', does: 'Printed, handwritten or unsure' },
        { keys: 'Enter', does: 'Confirm the scan and open the next one' },
      ]}
      note={action.note ?? arrived}
      action={
        data ? (
          <>
            <span className="summary">
              {scans.length === 1 ? 'The last scan' : `${scans.length} scans wait`}: this one has {mine.length} cells
              {fixed ? `, ${fixed} fixed` : ''}
            </span>
            <button type="button" className="primary" onClick={confirm} disabled={action.busy}>
              Confirm this scan <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      {scan.error ? <Failure message={scan.error} retry={scan.reload} /> : null}
      {!data && !scan.error ? <Working what="Cutting the scan…" /> : null}
      {data ? (
        <div className="scan">
          <figure className="scan-photo">
            <img src={photoImage(photo)} alt={`Scan ${photo}`} />
            <figcaption>
              {data.source === 'app'
                ? 'Uploaded scan. A red dot marks a cell that the player corrected.'
                : 'Imported photo.'}
            </figcaption>
          </figure>
          <div className="grid9" role="grid" aria-label="The 81 cells">
            {cells.map((c, n) => {
              if (!isCell(c))
                return (
                  <div key={`${c.row}-${c.col}`} className="place missing" title="No cell here: outside the photo" />
                )
              const entry = entries[c.id] ?? { digit: c.digit, kind: c.kind }
              const changed = entry.digit !== c.digit || entry.kind !== c.kind
              const why = c.shared ? `Labelled with scan ${c.shared}` : c.locked ? 'Discarded' : undefined
              return (
                <div key={`${c.row}-${c.col}`} className={`place${n === at ? ' selected' : ''}`}>
                  <CellTile
                    stem={c.stem}
                    label={entry.digit === 'empty' && !changed ? undefined : labelText(entry.digit, entry.kind)}
                    changed={changed}
                    dim={!own(c)}
                    title={why}
                    onClick={() => setAt(n)}
                  >
                    {c.edited ? <span className="edited" title="The player corrected this cell" /> : null}
                  </CellTile>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </Frame>
  )
}
