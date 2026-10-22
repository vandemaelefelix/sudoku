import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/** The route is the hash without `#/`, split at `/`: `#/a/outlines` is ['a', 'outlines']. */
export function useRoute(): string[] {
  const hash = useSyncExternalStore(
    (notify) => {
      window.addEventListener('hashchange', notify)
      return () => window.removeEventListener('hashchange', notify)
    },
    () => window.location.hash,
  )
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function go(path: string): void {
  window.location.hash = `#/${path}`
}

export type KeyHandlers = Partial<Record<string, (event: KeyboardEvent) => void>>

/** The keys of a step. A key is `event.key` in lower case. `digit` takes 0 to 9. */
export function useKeys(handlers: KeyHandlers, active = true): void {
  // A ref, so a handler sees the newest state without a new listener on each render.
  const current = useRef(handlers)
  useLayoutEffect(() => {
    current.current = handlers
  })
  useEffect(() => {
    if (!active) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const handler = current.current[key] ?? (/^[0-9]$/.test(key) ? current.current.digit : undefined)
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

export interface Loaded<T> {
  data: T | undefined
  error: string | undefined
  /** True until the data of the current key arrived. */
  loading: boolean
  reload: () => void
}

export function useLoad<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<{ key: string; round?: number; data?: T; error?: string }>({ key })
  const [round, setRound] = useState(0)
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    let live = true
    loader.current().then(
      (data) => live && setState({ key, round, data }),
      (error: unknown) =>
        live && setState({ key, round, error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      live = false
    }
  }, [key, round])
  const reload = useCallback(() => setRound((n) => n + 1), [])
  // The data of an older key stays visible while the new key loads: no flash of an empty step.
  const current = state.key === key
  const loading = !current || (state.data === undefined && state.error === undefined)
  return { data: state.data, error: current ? state.error : undefined, loading, reload }
}
