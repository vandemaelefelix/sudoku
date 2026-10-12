import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import type { Level } from '@sudoku/core'
import { newGeneratedGame } from '@/game/utils/start.utils'
import { HomeMenu } from '@/home/components/HomeMenu'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { REPLACE_CANCEL, REPLACE_CONFIRM, REPLACE_MESSAGE, REPLACE_TITLE } from './HomeScreen.constants'

function confirmReplace(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(REPLACE_TITLE, REPLACE_MESSAGE, [
      { text: REPLACE_CANCEL, style: 'cancel', onPress: () => resolve(false) },
      { text: REPLACE_CONFIRM, style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export function HomeScreen() {
  const router = useRouter()
  const { puzzles } = useGameStorage()
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
      await puzzles.start({ level, source: 'generated', game: newGeneratedGame(level, Math.random) })
      router.push('/game')
    })

  return (
    <HomeMenu
      continueLevel={continueLevel}
      onNewGame={newGame}
      onContinue={() => router.push('/game')}
      onScan={() => router.push('/scan')}
      onSettings={() => router.push('/settings')}
    />
  )
}
