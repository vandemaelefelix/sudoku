import type { KindTab } from '../../api/types'
import { KIND_TABS, kindName, tabName } from './modes'

interface TabBarProps {
  tabs: string[]
  tab: string
  /** The open cells and the confirmed cells per tab. */
  counts: Record<string, number>
  done: Record<string, number>
  onTab: (tab: string) => void
}

export function TabBar({ tabs, tab, counts, done, onTab }: TabBarProps) {
  return (
    <nav className="digit-tabs" aria-label="Tabs">
      {tabs
        .filter((t) => t !== 'unknown' || (counts[t] ?? 0) > 0)
        .map((t) => {
          const open = counts[t] ?? 0
          const finished = done[t] ?? 0
          return (
            <button
              key={t}
              type="button"
              className={t === tab ? 'here' : undefined}
              aria-current={t === tab ? 'page' : undefined}
              onClick={() => onTab(t)}
            >
              <span className="digit">{tabName(t)}</span> <span className="count">{open} open</span>{' '}
              <span className="progress">
                {finished} of {finished + open} done
              </span>
            </button>
          )
        })}
    </nav>
  )
}

interface KindBarProps {
  kind: KindTab
  /** The open cells of the digit per kind tab. */
  counts: Record<KindTab, number>
  onKind: (kind: KindTab) => void
}

/** The kind tabs of the Kind step. */
export function KindBar({ kind, counts, onKind }: KindBarProps) {
  return (
    <nav className="kind-tabs" aria-label="Kinds">
      {KIND_TABS.map((k) => (
        <button
          key={k}
          type="button"
          className={k === kind ? 'here' : undefined}
          aria-current={k === kind ? 'page' : undefined}
          onClick={() => onKind(k)}
        >
          {kindName(k)} <span className="count">{counts[k]}</span>
        </button>
      ))}
    </nav>
  )
}
