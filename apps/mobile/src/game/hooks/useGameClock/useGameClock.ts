import { useEffect, useRef } from 'react'
import { CLOCK_INTERVAL_MS } from '@/game/constants/game.constants'
import { MAX_ELAPSED_MS } from './useGameClock.constants'

/**
 * Calls onElapsed with the milliseconds since its last call, about once a second, while running is true.
 * One call reports at most MAX_ELAPSED_MS.
 */
export function useGameClock(running: boolean, onElapsed: (ms: number) => void): void {
  const callback = useRef(onElapsed)
  useEffect(() => {
    callback.current = onElapsed
  })
  useEffect(() => {
    if (!running) return undefined
    let last = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      callback.current(Math.min(now - last, MAX_ELAPSED_MS))
      last = now
    }, CLOCK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [running])
}
