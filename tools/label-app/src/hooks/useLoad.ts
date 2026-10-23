import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { errorMessage } from '../format'

export interface Loaded<T> {
  data: T | undefined
  error: string | undefined
  /** True until the data of the current key and the current reload arrived. */
  loading: boolean
  /** Load again with the same key. The old data stays until the new data arrives. */
  reload: () => void
  /** How often `reload` ran. A page can use it to refresh the images of the data. */
  round: number
}

export function useLoad<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<{ key: string; round: number; data?: T; error?: string }>({ key, round: 0 })
  const [round, setRound] = useState(0)
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    let live = true
    loader.current().then(
      (data) => live && setState({ key, round, data }),
      (error: unknown) => live && setState({ key, round, error: errorMessage(error) }),
    )
    return () => {
      live = false
    }
  }, [key, round])
  const reload = useCallback(() => setRound((n) => n + 1), [])
  // The data of an older key stays visible while the new key loads: no flash of an empty step.
  const current = state.key === key && state.round === round
  const loading = !current || (state.data === undefined && state.error === undefined)
  return { data: state.data, error: current ? state.error : undefined, loading, reload, round }
}
