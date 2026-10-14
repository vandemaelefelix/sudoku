import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import type { Level } from '@sudoku/core'
import { newGeneratedGame } from '@/game/utils/start.utils'
import { HomeMenu } from '@/home/components/HomeMenu'
import { useConfirmReplace } from '@/home/hooks/useConfirmReplace'
import { loadHomeStats, type HomeStats } from '@/home/utils/homeStats.utils'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'

export function HomeScreen() {
  const router = useRouter()
  const { puzzles, stats } = useGameStorage()
  const { includeScanned } = useIncludeScanned()
  const confirmReplace = useConfirmReplace()
  // peek() knows the game when a screen before read or started it. Else the menu waits for the focus read.
  const [continueLevel, setContinueLevel] = useState<Level | null | undefined>(() => {
    const known = puzzles.peek()
    return known === undefined ? undefined : (known?.level ?? null)
  })
  const [homeStats, setHomeStats] = useState<HomeStats | null | undefined>(undefined)
  // start() discards the game before it, so a second tap must not start a second game.
  const busy = useRef(false)

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
      loadHomeStats(stats, includeScanned)
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
    }, [puzzles, stats, includeScanned]),
  )

  const once = useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try {
      await task()
    } catch (error) {
      devWarn('storage', `The game does not start: ${errorMessage(error)}`)
    } finally {
      busy.current = false
    }
  }, [])

  const newGame = (level: Level) =>
    once(async () => {
      // Ask from the stored state at the tap. peek() follows the focus read, so the tap waits for no read.
      const known = puzzles.peek()
      const current = known === undefined ? await puzzles.current() : known
      if (current !== null && !(await confirmReplace())) return
      const { game, seed } = newGeneratedGame(level, Math.random)
      // The game screen opens on peek() while the write runs, so the push follows the tap at once.
      const starting = puzzles.start({ level, source: 'generated', seed, game })
      router.push('/game')
      await starting
    })

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
