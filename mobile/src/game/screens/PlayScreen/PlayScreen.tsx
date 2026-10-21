import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { toSavedGame, type Game } from '@sudoku/core'
import { SLOW_SAVE_MS } from '@/game/constants/save.constants'
import { GameSaveContext } from '@/game/hooks/useGameSession'
import { usePuzzleStart } from '@/game/hooks/usePuzzleStart'
import { GameScreen } from '@/game/screens/GameScreen'
import type { FinishInfo } from '@/game/utils/finish.utils'
import { createSaveQueue } from '@/game/utils/save.utils'
import type { BestTimes, SavedProgress } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
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
  const owner = useOwner()
  const puzzleStart = usePuzzleStart()
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
      .bestTimes(owner)
      .then((times) => live && setBest(times))
      .catch((error: unknown) => {
        devWarn('storage', `The best times do not load: ${errorMessage(error)}`)
        // Without best times the card still shows. It then knows no best time before this game.
        if (live) setBest({})
      })
    return () => {
      live = false
    }
  }, [history, owner])

  // A second queue for a new owner would let its older waiting game land after a newer move.
  // So the queue stays, and each write reads the owner at the time of the write (ADR-028).
  const ownerRef = useRef(owner)
  useEffect(() => {
    ownerRef.current = owner
  }, [owner])

  const id = progress?.id
  const save = useMemo(
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

  // Each restart is a new game in progress with a new id: save() moved a lost game to the history,
  // so the store ignores later saves under the old id. A failed start keeps the old screen.
  // The best times are read after the start: start() runs after that save, so they include the finished game.
  // The promises let the sheet rise again when the start fails.
  const show = useCallback(
    async (started: SavedProgress | null) => {
      if (started === null) return
      setProgress(started)
      try {
        setBest(await history.bestTimes(owner))
      } catch (error) {
        devWarn('storage', `The best times do not load: ${errorMessage(error)}`)
      }
    },
    [history, owner],
  )

  const newPuzzle = useCallback(async () => {
    if (progress !== null) await show(await puzzleStart.newPuzzle(progress))
  }, [puzzleStart, show, progress])

  const retry = useCallback(async () => {
    if (progress !== null) await show(await puzzleStart.retry(progress))
  }, [puzzleStart, show, progress])

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
