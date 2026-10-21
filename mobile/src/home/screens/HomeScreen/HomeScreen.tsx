import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import type { Level } from '@sudoku/core'
import { usePuzzleStart } from '@/game/hooks/usePuzzleStart'
import { HomeMenu } from '@/home/components/HomeMenu'
import { loadHomeStats, type HomeStats } from '@/home/utils/homeStats.utils'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { devWarn, errorMessage } from '@/utils/log.utils'

export function HomeScreen() {
  const router = useRouter()
  const { puzzles, stats } = useGameStorage()
  const { includeScanned } = useIncludeScanned()
  const owner = useOwner()
  const puzzleStart = usePuzzleStart()
  // peek() knows the game when a screen before read or started it. Else the menu waits for the focus read.
  const [continueLevel, setContinueLevel] = useState<Level | null | undefined>(() => {
    const known = puzzles.peek()
    return known === undefined ? undefined : (known?.level ?? null)
  })
  const [homeStats, setHomeStats] = useState<HomeStats | null | undefined>(undefined)

  useFocusEffect(
    useCallback(() => {
      let live = true
      puzzles
        .current()
        .then((progress) => {
          if (live) setContinueLevel(progress?.level ?? null)
        })
        .catch((error: unknown) => {
          devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`)
          // The menu waits for an answer. Without one it shows without Continue: a new game still works.
          if (live) setContinueLevel(null)
        })
      loadHomeStats(stats, { includeScanned, owner })
        .then((loaded) => {
          if (live) setHomeStats(loaded)
        })
        .catch((error: unknown) => {
          devWarn('storage', `The stats do not load: ${errorMessage(error)}`)
          // The menu waits for an answer. Without one it shows without the card: a new game still works.
          if (live) setHomeStats(null)
        })
      return () => {
        live = false
      }
    }, [puzzles, stats, includeScanned, owner]),
  )

  // The game screen opens on peek() while the write runs, so the push follows the tap at once.
  const newGame = (level: Level) => puzzleStart.newGame(level, () => router.push('/game'))

  return (
    <HomeMenu
      continueLevel={continueLevel}
      stats={homeStats}
      onNewGame={newGame}
      // navigate, not push: a second tap finds the open screen on top and pushes no second copy.
      // Two game screens for one game each save, so the older one can overwrite newer moves.
      onContinue={() => router.navigate('/game')}
      onScan={() => router.navigate('/scan')}
      onSettings={() => router.navigate('/settings')}
      // navigate, like Continue: a second tap finds the open screen and pushes no second copy.
      onStats={() => router.navigate('/stats')}
    />
  )
}
