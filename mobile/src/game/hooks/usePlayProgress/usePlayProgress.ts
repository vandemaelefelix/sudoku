import { useEffect, useState } from 'react'
import type { SavedProgress } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { startMeasures } from '@/utils/measure.utils'

/**
 * The game in progress from PuzzleRepository. A route param holds no game (ADR-016), and Continue must read
 * the last save of the screen before. The state starts from peek(), so the grid is there while the route slides in.
 * Only a game that the repository does not know yet waits for current(). With no game, or a failed load, it calls home.
 * setProgress shows the game of a new start.
 */
export function usePlayProgress(home: () => void) {
  const { puzzles } = useGameStorage()
  const [progress, setProgress] = useState<SavedProgress | null>(() => puzzles.peek() ?? null)

  // QR-12: the board is playable once the screen has the game. Only a level tap before it gives a log line.
  useEffect(() => {
    if (progress !== null) startMeasures.boardShown()
  }, [progress])

  useEffect(() => {
    let live = true
    const peeked = puzzles.peek()
    if (peeked === null) home()
    if (peeked !== undefined) return undefined
    puzzles
      .current()
      .then((current) => {
        if (!live) return
        if (current === null) home()
        else setProgress(current)
      })
      .catch((error: unknown) => {
        devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`)
        home()
      })
    return () => {
      live = false
    }
  }, [puzzles, home])

  return { progress, setProgress }
}
