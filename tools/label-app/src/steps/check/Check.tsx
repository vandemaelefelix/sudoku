import { useMemo, useState } from 'react'

import { get } from '../../api/client'
import { isKindPage, type CheckPage } from '../../api/types'
import { Empty, Frame, Working } from '../../components/Frame'
import { StepState } from '../../components/StepState'
import { useAction } from '../../hooks/useAction'
import { useKeys } from '../../hooks/useKeys'
import { useLoad } from '../../hooks/useLoad'
import { go } from '../../hooks/useRoute'
import { ConfirmBar } from './ConfirmBar'
import { Gallery } from './Gallery'
import { MODES, keysOf, kindName, type Mode } from './modes'
import { SureBar } from './SureBar'
import { KindBar, TabBar } from './TabBar'
import { useCheckActions } from './useCheckActions'
import { useCheckRoute, useMoveOn } from './useCheckRoute'
import { useDragSelect } from './useDragSelect'
import { useFixes } from './useFixes'
import { useSelection } from './useSelection'

interface Props {
  mode: Mode
  tab: string | undefined
  kind?: string | undefined
}

/** The Digits step and the Kind step: one screen, the most doubtful cells first. */
export function Check({ mode: id, tab: asked, kind: askedKind }: Props) {
  const mode = MODES[id]
  const route = useCheckRoute(mode, asked, askedKind)
  const { tab, kind } = route
  const [percentSure, setPercentSure] = useState(mode.threshold)
  const threshold = Number((percentSure / 100).toFixed(2))
  const page = useLoad(
    () =>
      get<CheckPage>(`/api/check/${id}?digit=${tab}&threshold=${threshold}${kind === 'all' ? '' : `&kind=${kind}`}`),
    `${id}:${tab}:${kind}:${threshold}`,
  )
  const action = useAction(page.reload)
  const data = page.data?.digit === tab ? page.data : undefined
  const cells = useMemo(() => data?.cells ?? [], [data])
  const { shownCount, nextKind } = useMoveOn(route, asked, page.data, data)
  const selection = useSelection(cells, data && `${tab}:${kind}:${cells.map((c) => c.id).join(',')}`)
  const drag = useDragSelect(selection.select)
  const fixes = useFixes(mode, cells)
  const { choose, confirm, confirmSure } = useCheckActions({ route, page, data, action, selection, fixes, threshold })

  useKeys({
    z: () => void action.undo(),
    Escape: () => (selection.selected.size ? selection.clear() : go('')),
    Enter: () => void confirm(),
    ArrowLeft: () => go(route.step(-1)),
    ArrowRight: () => go(route.step(1)),
    digit: (event) => choose(event.key),
    x: (event) => choose(event.key),
    p: (event) => choose(event.key),
    h: (event) => choose(event.key),
    u: (event) => choose(event.key),
  })

  const loaded = page.data
  const total = loaded ? Object.values(loaded.counts).reduce((a, b) => a + b, 0) : 0
  const kindCounts = data && isKindPage(data) ? data.kind_counts : undefined
  return (
    <Frame
      step={id}
      task={mode.task}
      keys={keysOf(mode)}
      note={action.note}
      action={
        cells.length ? (
          <ConfirmBar
            cells={cells.length}
            left={data?.left ?? 0}
            selected={selection.selected.size}
            fixed={fixes.count}
            disabled={action.busy || page.loading}
            onConfirm={() => void confirm()}
          />
        ) : undefined
      }
    >
      <StepState
        load={page}
        working="Loading the cells…"
        empty={
          total === 0
            ? {
                why: mode.empty,
                next: (
                  <button type="button" className="primary" onClick={() => go(mode.next.route)}>
                    Next: {mode.next.name}
                  </button>
                ),
              }
            : undefined
        }
      >
        <TabBar
          tabs={mode.tabs}
          tab={tab}
          counts={loaded?.counts ?? {}}
          done={loaded?.done ?? {}}
          onTab={(t) => go(route.to(t))}
        />
        {kindCounts ? <KindBar kind={kind} counts={kindCounts} onKind={(k) => go(route.to(tab, k))} /> : null}
        <SureBar
          percent={percentSure}
          onPercent={setPercentSure}
          sure={data?.sure ?? 0}
          loading={page.loading}
          busy={action.busy}
          onConfirm={() => void confirmSure()}
        />
        {selection.warning ? (
          <p className="warning" role="alert">
            {selection.warning}
          </p>
        ) : null}
        {data && kind !== 'all' && shownCount === 0 && !page.loading ? (
          <Empty
            why={`No ${kind} cell of the digit ${tab} is open. A cell is open until you confirm its kind.`}
            next={
              nextKind ? (
                <button type="button" className="primary" onClick={() => go(route.to(tab, nextKind))}>
                  Next: {kindName(nextKind)}
                </button>
              ) : undefined
            }
          />
        ) : data && cells.length === 0 ? (
          <Working what="Loading the cells…" />
        ) : null}
        <Gallery
          mode={mode}
          cells={cells}
          selected={selection.selected}
          fixes={fixes}
          drag={drag}
          onClick={(cellId, event) => {
            if (!drag.wasDrag()) selection.click(cellId, event.shiftKey)
          }}
        />
      </StepState>
    </Frame>
  )
}
