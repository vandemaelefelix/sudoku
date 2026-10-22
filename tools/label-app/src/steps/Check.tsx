import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

import { get, post } from '../api/client'
import { DIGITS, type CheckCell, type CheckPage, type Kind, type Label } from '../api/types'
import { CellDetail, percent } from '../components/CellDetail'
import { KIND_LETTER, CellTile, labelText } from '../components/CellTile'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad, type KeyHandlers } from '../hooks'
import { useAction } from '../useAction'

export type Mode = 'digits' | 'kinds'

const CONFIG = {
  digits: {
    tabs: [...DIGITS, 'unknown'] as string[],
    threshold: 98,
    what: 'digit',
    next: { name: 'Kind', route: 'kinds' },
  },
  kinds: {
    tabs: DIGITS.slice(1) as string[],
    threshold: 95,
    what: 'kind',
    next: { name: 'Finish', route: 'finish' },
  },
}

const tabName = (tab: string): string => (tab === 'empty' ? 'Empty' : tab === 'unknown' ? 'No guess' : tab)

/** The first tab after `tab` that has cells, around the end. */
function nextWithCells(tabs: string[], tab: string, counts: Record<string, number>): string | undefined {
  const at = tabs.indexOf(tab)
  return [...tabs.slice(at + 1), ...tabs.slice(0, at)].find((t) => (counts[t] ?? 0) > 0)
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** The Digits step and the Kind step: one screen, the most doubtful cells first. */
export function Check({ mode, tab: asked }: { mode: Mode; tab: string | undefined }) {
  const config = CONFIG[mode]
  const tab = asked && config.tabs.includes(asked) ? asked : config.tabs[0]!
  const [round, setRound] = useState(0)
  const [percentSure, setPercentSure] = useState(config.threshold)
  const [draft, setDraft] = useState(String(config.threshold))
  const threshold = Number((percentSure / 100).toFixed(2))
  const page = useLoad(
    () => get<CheckPage>(`/api/check/${mode}?digit=${tab}&threshold=${threshold}`),
    `${mode}:${tab}:${threshold}:${round}`,
  )
  const action = useAction(() => setRound((n) => n + 1))
  const [fixes, setFixes] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  // A drag ends with a click on the tile under the pointer. That click must not toggle the tile.
  const dragged = useRef(false)

  const data = page.data?.digit === tab ? page.data : undefined
  const cells = useMemo(() => data?.cells ?? [], [data])
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0
  const onward = data && (data.counts[tab] ?? 0) === 0 ? nextWithCells(config.tabs, tab, data.counts) : undefined
  const first = page.data ? config.tabs.find((t) => (page.data!.counts[t] ?? 0) > 0) : undefined
  useEffect(() => {
    if (!asked && first && first !== tab) go(`${mode}/${first}`)
    else if (onward) go(`${mode}/${onward}`)
  }, [mode, asked, first, tab, onward])

  const [pageKey, setPageKey] = useState('')
  const pageId = `${tab}:${cells.map((c) => c.id).join(',')}`
  if (data && pageKey !== pageId) {
    // A new page clears the selection. The fixes stay: they belong to a cell.
    setPageKey(pageId)
    setSelected(new Set())
    setAnchor(null)
    setWarning(null)
  }

  const current = (c: CheckCell): string | null => (mode === 'digits' ? c.digit : c.kind)
  const valueOf = (c: CheckCell): string | null => fixes[c.id] ?? current(c)
  const show = (value: string | null): string =>
    value === null ? '?' : mode === 'digits' ? labelText(value as Label) : KIND_LETTER[value as Kind]

  const select = (ids: string[], add: boolean): void => {
    setSelected((all) => new Set(add ? [...all, ...ids] : ids))
    setWarning(null)
  }

  const click = (id: string, event: ReactMouseEvent): void => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    const from = anchor === null ? -1 : cells.findIndex((c) => c.id === anchor)
    const to = cells.findIndex((c) => c.id === id)
    if (event.shiftKey && from >= 0) {
      const [a, b] = from < to ? [from, to] : [to, from]
      select(
        cells.slice(a, b + 1).map((c) => c.id),
        true,
      )
    } else {
      setSelected((all) => {
        const toggled = new Set(all)
        if (!toggled.delete(id)) toggled.add(id)
        return toggled
      })
      setAnchor(id)
      setWarning(null)
    }
  }

  const startDrag = (event: ReactMouseEvent): void => {
    if (event.button !== 0) return
    const add = event.shiftKey || event.metaKey || event.ctrlKey
    const x0 = event.clientX
    const y0 = event.clientY
    let moving = false
    const move = (m: MouseEvent): void => {
      if (!moving && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return
      moving = true
      setBox({
        left: Math.min(x0, m.clientX),
        top: Math.min(y0, m.clientY),
        width: Math.abs(m.clientX - x0),
        height: Math.abs(m.clientY - y0),
      })
    }
    const up = (u: MouseEvent): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      if (!moving) return
      setBox(null)
      dragged.current = true
      window.setTimeout(() => (dragged.current = false), 0)
      const [l, r] = [Math.min(x0, u.clientX), Math.max(x0, u.clientX)]
      const [t, b] = [Math.min(y0, u.clientY), Math.max(y0, u.clientY)]
      const hit = [...(galleryRef.current?.querySelectorAll<HTMLElement>('[data-id]') ?? [])]
        .filter((el) => {
          const rect = el.getBoundingClientRect()
          return rect.left <= r && rect.right >= l && rect.top <= b && rect.bottom >= t
        })
        .map((el) => el.dataset.id!)
      select(hit, add)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const apply = (value: string, words: string): void => {
    if (!selected.size) {
      setWarning('Select cells first. Click one, shift-click a range, drag a box, or press ⌘A.')
      return
    }
    const picked = cells.filter((c) => selected.has(c.id))
    setFixes((all) => {
      const next = { ...all }
      for (const c of picked) {
        if (value === current(c)) delete next[c.id]
        else next[c.id] = value
      }
      return next
    })
    setSelected(new Set())
    setWarning(null)
    action.setNote(`Set ${plural(picked.length, 'cell')} to ${words}. Enter confirms the page.`)
  }

  const wrongKey = (): void =>
    setWarning(
      mode === 'digits'
        ? 'The Digits step has no kind. The Kind step comes next.'
        : 'The Kind step does not change digits. Go back to Digits to fix a digit.',
    )

  const doConfirm = async (): Promise<void> => {
    if (!data || action.busy || page.loading || !cells.length) return
    const missing = cells.filter((c) => valueOf(c) === null).length
    if (missing) {
      setWarning(
        mode === 'digits'
          ? `${plural(missing, 'cell')} ${missing === 1 ? 'has' : 'have'} no digit yet. Select each one and type its digit.`
          : `${plural(missing, 'cell')} ${missing === 1 ? 'has' : 'have'} no kind yet. Select each one and press P or H.`,
      )
      return
    }
    const body = cells.map((c) =>
      mode === 'digits' ? { id: c.id, digit: valueOf(c) } : { id: c.id, kind: valueOf(c) },
    )
    const fixed = cells.filter((c) => fixes[c.id] !== undefined).length
    const left = (data.counts[tab] ?? 0) - cells.length
    const where =
      left > 0
        ? `${plural(left, 'cell')} of this tab ${left === 1 ? 'is' : 'are'} left.`
        : nextWithCells(config.tabs, tab, { ...data.counts, [tab]: 0 })
          ? 'This tab is done. The next tab with cells opens.'
          : `Every tab is done. Next: ${config.next.name}.`
    const done = await action.run(
      () => post<number>(`/api/check/${mode}/confirm`, { cells: body }),
      () => `Confirmed ${plural(cells.length, 'cell')}${fixed ? `, ${fixed} with a fix` : ''}. ${where}`,
    )
    if (done !== undefined) {
      const ids = new Set(cells.map((c) => c.id))
      setFixes((all) => Object.fromEntries(Object.entries(all).filter(([id]) => !ids.has(id))))
      setSelected(new Set())
    }
    setRound((n) => n + 1)
  }

  const confirmSure = async (): Promise<void> => {
    if (!data || action.busy || page.loading || !data.sure) return
    const done = await action.run(
      () => post<{ cells: number }>(`/api/check/${mode}/sure`, { digit: tab, threshold }),
      (r) =>
        `Confirmed ${plural(r.cells, 'sure cell')} of this tab. The cells that are left need a look. Select the wrong ones and press a key.`,
    )
    if (done !== undefined) setSelected(new Set())
    setRound((n) => n + 1)
  }

  const clearOrBack = (): void => {
    if (selected.size) setSelected(new Set())
    else go('')
  }

  const step = (by: number): void => {
    const at = config.tabs.indexOf(tab)
    go(`${mode}/${config.tabs[(at + by + config.tabs.length) % config.tabs.length]}`)
  }

  const keys: KeyHandlers = {
    z: () => void action.undo(),
    Escape: clearOrBack,
    Enter: () => void doConfirm(),
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
    digit: (event) => {
      if (mode === 'kinds') return wrongKey()
      const digit = event.key === '0' ? 'empty' : event.key
      apply(digit, digit === 'empty' ? 'empty' : digit)
    },
    x: () => (mode === 'kinds' ? wrongKey() : apply('discarded', 'discarded')),
    p: () => (mode === 'kinds' ? apply('printed', 'printed') : wrongKey()),
    h: () => (mode === 'kinds' ? apply('handwritten', 'handwritten') : wrongKey()),
    u: () => (mode === 'kinds' ? apply('unsure', 'unsure') : wrongKey()),
  }
  useKeys(keys)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'a') return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      event.preventDefault()
      setSelected(new Set(cells.map((c) => c.id)))
      setWarning(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cells])

  const shown = cells.find((c) => c.id === focus) ?? cells[0]
  const fixed = cells.filter((c) => fixes[c.id] !== undefined).length
  const tabs = config.tabs.filter((t) => t !== 'unknown' || (data?.counts[t] ?? page.data?.counts[t] ?? 0) > 0)
  const counts = (data ?? page.data)?.counts ?? {}
  const done = (data ?? page.data)?.done ?? {}
  const keyList =
    mode === 'digits'
      ? [
          { keys: '0–9', does: 'Give the selected cells their digit (0 is empty)' },
          { keys: 'X', does: 'Discard the selected cells' },
        ]
      : [{ keys: 'P H U', does: 'Printed, handwritten or unsure for the selected cells' }]

  return (
    <Frame
      step={mode}
      task={
        mode === 'digits'
          ? 'The cells with the most doubt come first. Select each cell with a wrong digit and type its digit. Enter confirms the rest.'
          : 'The cells with the most doubt come first. Select each cell with a wrong kind and press P or H. Enter confirms the rest.'
      }
      keys={[
        { keys: 'Click', does: 'Select a cell, or unselect it' },
        { keys: 'Shift-click', does: 'Select the range from the last clicked cell' },
        { keys: 'Drag', does: 'Draw a box around cells to select them' },
        { keys: '⌘A', does: 'Select the page' },
        ...keyList,
        { keys: 'Enter', does: 'Confirm the page: the fixes, and the current label for the rest' },
        { keys: '← →', does: 'Previous or next tab' },
        { keys: 'Esc', does: 'Clear the selection. With none selected, go back to the start' },
      ]}
      note={action.note}
      action={
        cells.length ? (
          <>
            <span className="summary">
              {selected.size ? `${selected.size} selected, ` : ''}
              {fixed ? `${fixed} fixed, ` : ''}
              {cells.length < (data?.left ?? 0)
                ? `${cells.length} of ${data?.left} shown`
                : `${cells.length} on the page`}
            </span>
            <button
              type="button"
              className="primary"
              onClick={() => void doConfirm()}
              disabled={action.busy || page.loading}
            >
              Confirm {cells.length} cells <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      {page.error ? <Failure message={page.error} retry={page.reload} /> : null}
      {!page.data && !page.error ? <Working what="Loading the cells…" /> : null}
      {page.data && total === 0 ? (
        <Empty
          why={
            mode === 'digits'
              ? 'No cell waits for a digit. Cells of approved scans and loose cells appear here.'
              : 'No cell waits for a kind. A cell needs a confirmed digit first.'
          }
          next={
            <button type="button" className="primary" onClick={() => go(config.next.route)}>
              Next: {config.next.name}
            </button>
          }
        />
      ) : null}
      {page.data && total > 0 ? (
        <>
          <nav className="digit-tabs" aria-label="Tabs">
            {tabs.map((t) => {
              const open = counts[t] ?? 0
              const finished = done[t] ?? 0
              return (
                <button
                  key={t}
                  type="button"
                  className={t === tab ? 'here' : undefined}
                  aria-current={t === tab ? 'page' : undefined}
                  onClick={() => go(`${mode}/${t}`)}
                >
                  <span className="digit">{tabName(t)}</span> <span className="count">{open} open</span>{' '}
                  <span className="progress">
                    {finished} of {finished + open} done
                  </span>
                </button>
              )
            })}
          </nav>
          <div className="check-tools">
            <div className="legend" aria-label="Legend">
              <span>Edge: sure</span>
              <span className="legend-bar" aria-hidden="true" />
              <span>doubtful</span>
              <span className="badge grey">as given</span>
              <span className="badge blue">your fix, tinted</span>
              <span className="badge selected">selected</span>
            </div>
            <div className="sure">
              <label>
                Threshold
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    const n = Math.round(Number(e.target.value))
                    if (e.target.value !== '' && n >= 50 && n <= 100) setPercentSure(n)
                  }}
                />{' '}
                %
              </label>
              <button
                type="button"
                onClick={() => void confirmSure()}
                disabled={action.busy || page.loading || !data?.sure}
              >
                {page.loading
                  ? `Counting the cells the model is at least ${percentSure} % sure of…`
                  : `Confirm ${data?.sure ?? 0} cells the model is at least ${percentSure} % sure of`}
              </button>
            </div>
          </div>
          {warning ? (
            <p className="warning" role="alert">
              {warning}
            </p>
          ) : null}
          {data && cells.length === 0 ? <Working what="Loading the cells…" /> : null}
          <div className="check">
            <div className="check-cells">
              <div className="gallery" ref={galleryRef} onMouseDown={startDrag}>
                {cells.map((c) => (
                  <CellTile
                    key={c.id}
                    id={c.id}
                    stem={c.stem}
                    doubt={c.doubt}
                    marked={selected.has(c.id)}
                    changed={fixes[c.id] !== undefined}
                    label={show(valueOf(c))}
                    title={`Doubt ${percent(c.doubt)}`}
                    onClick={(event) => click(c.id, event)}
                    onHover={() => setFocus(c.id)}
                  />
                ))}
              </div>
            </div>
            {shown ? (
              <CellDetail
                cell={shown}
                mode={mode}
                fix={fixes[shown.id] === undefined ? undefined : show(fixes[shown.id]!)}
              />
            ) : null}
          </div>
          {box ? <div className="drag-box" style={box} aria-hidden="true" /> : null}
        </>
      ) : null}
    </Frame>
  )
}
