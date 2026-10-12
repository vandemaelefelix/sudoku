import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import type { Level } from '@sudoku/core'
import { newGeneratedGame } from '@/game/utils/start.utils'
import { HomeMenu } from '@/home/components/HomeMenu'
import { useConfirmReplace } from '@/home/hooks/useConfirmReplace'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'

export function HomeScreen() {
  const router = useRouter()
  const { puzzles } = useGameStorage()
  const confirmReplace = useConfirmReplace()
  const [continueLevel, setContinueLevel] = useState<Level | null>(null)
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
        .catch((error: unknown) => devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`))
      return () => {
        live = false
      }
    }, [puzzles]),
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
      // Ask from the stored state at the tap: the focus refresh can still be on its way.
      if ((await puzzles.current()) !== null && !(await confirmReplace())) return
      const { game, seed } = newGeneratedGame(level, Math.random)
      await puzzles.start({ level, source: 'generated', seed, game })
      router.push('/game')
    })

  return (
    <HomeMenu
      continueLevel={continueLevel}
      onNewGame={newGame}
      // navigate, not push: a second tap finds the open screen on top and pushes no second copy.
      // Two game screens for one game each save, so the older one can overwrite newer moves.
      onContinue={() => router.navigate('/game')}
      onScan={() => router.navigate('/scan')}
      onSettings={() => router.navigate('/settings')}
    />
  )
}
