import { useEffect, useState } from 'react'

/**
 * True once on has stayed true for holdMs, and false while on is false. A hold counts once: on is a gate of a finished
 * game, and a finished game never plays again. A new game mounts a new hook.
 */
export function useHold(on: boolean, holdMs: number): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!on) return undefined
    const timer = setTimeout(() => setHeld(true), holdMs)
    return () => clearTimeout(timer)
  }, [on, holdMs])
  return on && held
}
