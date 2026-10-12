import { useCallback, useEffect, useRef } from 'react'
import { CLOCK_INTERVAL_MS } from '@/game/constants/game.constants'
import { MAX_ELAPSED_MS } from './useGameClock.constants'

/**
 * Calls onElapsed with the milliseconds since its last call, about once a second, while running is true.
 * One call reports at most MAX_ELAPSED_MS.
 * Returns flush, which reports the time since the last call at once. It does nothing while not running.
 * flush keeps its identity between renders.
 */
export function useGameClock(running: boolean, onElapsed: (ms: number) => void): () => void {
  const callback = useRef(onElapsed)
  // null while the clock does not run.
  const last = useRef<number | null>(null)
  useEffect(() => {
    callback.current = onElapsed
  })
  const flush = useCallback(() => {
    if (last.current === null) return
    const now = Date.now()
    callback.current(Math.min(now - last.current, MAX_ELAPSED_MS))
    last.current = now
  }, [])
  useEffect(() => {
    if (!running) return undefined
    last.current = Date.now()
    const timer = setInterval(flush, CLOCK_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      last.current = null
    }
  }, [running, flush])
  return flush
}
