import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { createGame, toSavedGame, type Game } from '@sudoku/core'
import { SLOW_SAVE_MS } from '@/game/constants/save.constants'
import { GameSaveContext } from '@/game/hooks/useGameSaver'
import { GameScreen } from '@/game/screens/GameScreen'
import type { FinishInfo } from '@/game/utils/finish.utils'
import { createSaveQueue } from '@/game/utils/save.utils'
import { newGeneratedGame } from '@/game/utils/start.utils'
import type { BestTimes, PuzzleSource, SavedProgress } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devLog, devWarn, errorMessage } from '@/utils/log.utils'
import { styles } from './PlayScreen.styles'

function logSave(game: Game, ms: number) {
  if (!__DEV__) return
  // The size is measured only in a development build: it costs one more JSON pass.
  const bytes = JSON.stringify(toSavedGame(game)).length
  const slow = ms > SLOW_SAVE_MS ? ' (slow)' : ''
  devLog('storage', `saved in ${ms.toFixed(1)} ms, ${bytes} bytes${slow}`)
}

/**
 * The game in progress from PuzzleRepository. A route param holds no game (ADR-016), and Continue must read
 * the last save of the screen before. PuzzleRepository.save also moves a won or lost game to the history (ADR-012).
 * The screen starts from peek(), so the grid is there while the route slides in. Only a game that the repository
 * does not know yet waits for current(). The best times load after the game: they change only when a game finishes.
 */
export function PlayScreen() {
  const router = useRouter()
  const { puzzles, history } = useGameStorage()
  const [progress, setProgress] = useState<SavedProgress | null>(() => puzzles.peek() ?? null)
  const [best, setBest] = useState<BestTimes | null>(null)

  const home = useCallback(() => router.dismissTo('/'), [router])

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

  useEffect(() => {
    let live = true
    history
      .bestTimes()
      .then((times) => live && setBest(times))
      .catch((error: unknown) => {
        devWarn('storage', `The best times do not load: ${errorMessage(error)}`)
        // Without best times the card still shows. It then knows no best time before this game.
        if (live) setBest({})
      })
    return () => {
      live = false
    }
  }, [history])

  const id = progress?.id
  const save = useMemo(
    () =>
      id === undefined
        ? null
        : createSaveQueue((game) => puzzles.save(id, game), {
            saved: logSave,
            failed: (error) => devWarn('storage', `The game does not save: ${errorMessage(error)}`),
          }),
    [puzzles, id],
  )

  // Each restart is a new game in progress with a new id: save() moved a lost game to the history,
  // so the store ignores later saves under the old id. A failed start keeps the old screen.
  // The best times are read after the start: start() runs after that save, so they include the finished game.
  const restartWith = useCallback(
    async (source: PuzzleSource, make: (current: SavedProgress) => { game: Game; seed: number | null }) => {
      if (progress === null) return
      try {
        const { game, seed } = make(progress)
        const started = await puzzles.start({ level: progress.level, source, seed, game })
        setProgress(started)
        setBest(await history.bestTimes())
      } catch (error) {
        devWarn('storage', `The game does not start: ${errorMessage(error)}`)
      }
    },
    [puzzles, history, progress],
  )

  // The promises let the sheet rise again when the start fails.
  const newPuzzle = useCallback(
    () => restartWith('generated', (current) => newGeneratedGame(current.level, Math.random)),
    [restartWith],
  )

  const retry = useCallback(async () => {
    if (progress === null) return
    await restartWith(progress.source, ({ game, seed }) => ({
      game: createGame({ givens: game.givens, solution: game.solution, entries: game.startEntries }),
      seed,
    }))
  }, [restartWith, progress])

  // Without the best times, the screen shows no finish card: the card compares against the best time before this game.
  const finish = useMemo<FinishInfo | undefined>(
    () =>
      progress === null || best === null
        ? undefined
        : {
            level: progress.level,
            source: progress.source,
            seed: progress.seed,
            bestBeforeMs: best[progress.level] ?? null,
          },
    [progress, best],
  )

  // A game that the repository does not know yet: an empty themed screen keeps the route from a blank flash.
  if (progress === null || save === null) return <View testID="play-loading" style={styles.loading} />
  return (
    <GameSaveContext value={save}>
      {/* A new id mounts a new game screen. A Game in start resumes as it was saved (startSession). */}
      <GameScreen
        key={progress.id}
        start={progress.game}
        finish={finish}
        onBack={home}
        onNewPuzzle={newPuzzle}
        onRetry={retry}
      />
    </GameSaveContext>
  )
}
