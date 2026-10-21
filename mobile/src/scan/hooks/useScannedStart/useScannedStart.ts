import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { usePuzzleStart } from '@/game/hooks/usePuzzleStart'
import type { ScannedStart } from '@/scan/utils/play.utils'

/** Starts a scanned puzzle as the game in progress (source scanned), then shows the game in place of the scan. */
export function useScannedStart(): (start: ScannedStart) => Promise<void> {
  const router = useRouter()
  const puzzleStart = usePuzzleStart()

  return useCallback(
    async (start) => {
      // Replace, not push: Back on the game goes home, and the camera stops with the scan route.
      await puzzleStart.playScan(start, () => router.replace('/game'))
    },
    [puzzleStart, router],
  )
}
