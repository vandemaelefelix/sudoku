import { useState } from 'react'

import { get, post } from '../api/client'
import type { DoubtReason, DoubtfulItem, DoubtfulPage, Kind, Label } from '../api/types'
import { CellTile, labelText } from '../components/CellTile'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

interface Entry {
  digit: Label
  kind: Kind | null
}

const percent = (p: number | undefined): string => (p === undefined ? '' : ` (${Math.round(p * 100)} %)`)

export function reasonText(r: DoubtReason): string {
  if (r.reason === 'digit-model') return `The model reads ${r.predicted}${percent(r.p_predicted)}`
  if (r.reason === 'kind-model') return `The model reads ${r.predicted}`
  if (r.reason === 'near-duplicate') return 'A near copy has the other kind'
  return 'A blind check gave another kind'
}

const start = (item: DoubtfulItem): Entry => ({ digit: item.folder as Label, kind: item.kind })

/** Flow B step 4: the labels that `just suspects` and the near copies doubt. */
export function Doubtful() {
  const [round, setRound] = useState(0)
  const page = useLoad(() => get<DoubtfulPage>('/api/doubtful'), `doubtful:${round}`)
  const action = useAction(() => setRound((n) => n + 1))
  const data = page.data
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [shown, setShown] = useState<DoubtfulPage | undefined>()
  if (data !== shown) {
    setShown(data)
    setEntries({})
    setSelected(null)
  }
  const entryOf = (item: DoubtfulItem): Entry => entries[item.id] ?? start(item)
  const change = (update: Partial<Entry>): void => {
    const item = data?.items.find((i) => i.id === selected)
    if (!item) {
      action.setNote('Click a cell first.')
      return
    }
    const next = { ...entryOf(item), ...update }
    if (next.digit === 'empty' || next.digit === 'discarded') next.kind = null
    else if (!next.kind) next.kind = 'printed'
    setEntries((all) => ({ ...all, [item.id]: next }))
  }

  const find = async (): Promise<void> => {
    await action.run(
      () => post<{ open: number }>('/api/suspects'),
      (r) => (r.open ? `Found ${r.open} doubtful labels.` : 'Found no doubtful label.'),
    )
    setRound((n) => n + 1)
  }

  const save = async (): Promise<void> => {
    if (!data?.items.length || action.busy) return
    const cells = data.items.map((i) => ({ id: i.id, ...entryOf(i) }))
    const open = cells.filter((c) => c.digit !== 'empty' && c.digit !== 'discarded' && !c.kind).length
    if (open) {
      action.setNote(`${open} cells have a digit without a kind. Click each one and press P or H.`)
      return
    }
    await action.run(
      () => post<number>('/api/doubtful/save', { cells }),
      () => `Settled ${cells.length} labels.`,
    )
    setRound((n) => n + 1)
  }

  useKeys({
    digit: (event) => change({ digit: event.key === '0' ? 'empty' : (event.key as Label) }),
    x: () => change({ digit: 'discarded' }),
    p: () => change({ kind: 'printed' }),
    h: () => change({ kind: 'handwritten' }),
    u: () => change({ kind: 'unsure' }),
    Enter: save,
    z: action.undo,
    Escape: () => go(''),
  })

  const items = data?.items ?? []
  return (
    <Frame
      flow="b"
      step="doubtful"
      task="A check doubts these labels. Click a wrong one and fix it. Enter keeps the rest as they are."
      keys={[
        { keys: 'Click', does: 'Select a cell' },
        { keys: '0–9, X', does: 'Give the selected cell its digit, or discard it' },
        { keys: 'P H U', does: 'Printed, handwritten or unsure' },
        { keys: 'Enter', does: 'Settle the page: the fixes, and the other labels as they are' },
      ]}
      note={action.note}
      action={
        items.length ? (
          <>
            <span className="summary">
              {items.length} of {data?.open} shown
            </span>
            <button type="button" className="primary" onClick={save} disabled={action.busy}>
              Settle {items.length} labels <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      {page.error ? <Failure message={page.error} retry={page.reload} /> : null}
      {action.busy ? (
        <Working what="Working. Finding doubtful labels trains 5 small models and takes some minutes…" />
      ) : null}
      {page.loading && !data && !action.busy ? (
        <Working what="Comparing the cells. The first time takes about 30 seconds…" />
      ) : null}
      {data && !items.length && !action.busy ? (
        <Empty
          why={data.suspects ? 'No doubtful label is left.' : 'The model has not looked for doubtful labels yet.'}
          next={
            <>
              <button type="button" onClick={find}>
                {data.suspects ? 'Look again' : 'Find doubtful labels'}
              </button>{' '}
              <button type="button" className="primary" onClick={() => go('b/finish')}>
                Next: Finish
              </button>
            </>
          }
        />
      ) : null}
      {items.length ? (
        <div className="doubt-list">
          {items.map((item) => {
            const entry = entryOf(item)
            const changed = entries[item.id] !== undefined
            return (
              <div key={item.id} className="doubt">
                <CellTile
                  stem={item.stem}
                  label={labelText(entry.digit, entry.kind)}
                  marked={selected === item.id}
                  changed={changed}
                  onClick={() => setSelected(selected === item.id ? null : item.id)}
                />
                <p>{item.reasons.map(reasonText).join('. ')}</p>
              </div>
            )
          })}
        </div>
      ) : null}
    </Frame>
  )
}
