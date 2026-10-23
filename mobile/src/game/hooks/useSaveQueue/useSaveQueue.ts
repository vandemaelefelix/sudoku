import { useEffect, useMemo, useRef } from 'react'
import { toSavedGame, type Game } from '@sudoku/core'
import { SLOW_SAVE_MS } from '@/game/constants/saveQueue.constants'
import { createSaveQueue } from '@/game/utils/saveQueue.utils'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { devLog, devWarn, errorMessage } from '@/utils/log.utils'

function logSave(game: Game, ms: number) {
  if (!__DEV__) return
  // The size is measured only in a development build: it costs one more JSON pass.
  const bytes = JSON.stringify(toSavedGame(game)).length
  const slow = ms > SLOW_SAVE_MS ? ' (slow)' : ''
  devLog('storage', `saved in ${ms.toFixed(1)} ms, ${bytes} bytes${slow}`)
}

/**
 * The save queue of the game with this id, or null while there is no game. PuzzleRepository.save also moves a
 * won or lost game to the history (ADR-012).
 */
export function useSaveQueue(id: string | undefined) {
  const { puzzles } = useGameStorage()
  const owner = useOwner()
  // A second queue for a new owner would let its older waiting game land after a newer move.
  // So the queue stays, and each write reads the owner at the time of the write (ADR-028).
  const ownerRef = useRef(owner)
  useEffect(() => {
    ownerRef.current = owner
  }, [owner])

  return useMemo(
    () =>
      id === undefined
        ? null
        : createSaveQueue(
            // oxlint-disable-next-line react/refs -- the queue reads the ref when it writes, not during render
            (game) => puzzles.save(id, game, ownerRef.current),
            {
              saved: logSave,
              failed: (error) => devWarn('storage', `The game does not save: ${errorMessage(error)}`),
            },
          ),
    [puzzles, id],
  )
}
