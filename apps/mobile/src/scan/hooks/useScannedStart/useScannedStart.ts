import { useRouter } from 'expo-router'
import { useCallback, useRef } from 'react'
import { createGame } from '@sudoku/core'
import { useConfirmReplace } from '@/home/hooks/useConfirmReplace'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** Starts a scanned puzzle as the game in progress (source scanned), then shows the game in place of the scan. */
export function useScannedStart(): (start: ScannedStart) => Promise<void> {
  const router = useRouter()
  const { puzzles } = useGameStorage()
  const confirmReplace = useConfirmReplace()
  // start() discards the game before it, so a second tap must not start a second game.
  const busy = useRef(false)

  return useCallback(
    async ({ level, puzzle }: ScannedStart) => {
      if (busy.current) return
      busy.current = true
      try {
        // Ask from the stored state at the tap, as the home screen does.
        if ((await puzzles.current()) !== null && !(await confirmReplace())) return
        await puzzles.start({ level, source: 'scanned', game: createGame(puzzle) })
        // Replace, not push: Back on the game goes home, and the camera stops with the scan route.
        router.replace('/game')
      } catch (error) {
        devWarn('storage', `The scanned game does not start: ${errorMessage(error)}`)
      } finally {
        busy.current = false
      }
    },
    [puzzles, confirmReplace, router],
  )
}
