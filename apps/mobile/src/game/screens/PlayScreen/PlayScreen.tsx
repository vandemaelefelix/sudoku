import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createGame, toSavedGame, type Game } from '@sudoku/core'
import { SLOW_SAVE_MS } from '@/game/constants/save.constants'
import { GameSaveContext } from '@/game/hooks/useGameSaver'
import { GameScreen } from '@/game/screens/GameScreen'
import { createSaveQueue } from '@/game/utils/save.utils'
import { newGeneratedGame } from '@/game/utils/start.utils'
import type { SavedProgress } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devLog, devWarn, errorMessage } from '@/utils/log.utils'

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
 */
export function PlayScreen() {
  const router = useRouter()
  const { puzzles } = useGameStorage()
  const [progress, setProgress] = useState<SavedProgress | null>(null)

  const home = useCallback(() => router.dismissTo('/'), [router])

  useEffect(() => {
    let live = true
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
  const restartWith = useCallback(
    async (makeGame: (current: SavedProgress) => Game) => {
      if (progress === null) return
      try {
        const game = makeGame(progress)
        setProgress(await puzzles.start({ level: progress.level, source: progress.source, game }))
      } catch (error) {
        devWarn('storage', `The game does not start: ${errorMessage(error)}`)
      }
    },
    [puzzles, progress],
  )

  const newPuzzle = useCallback(() => {
    void restartWith((current) => newGeneratedGame(current.level, Math.random))
  }, [restartWith])

  const retry = useCallback(() => {
    void restartWith(({ game }) =>
      createGame({ givens: game.givens, solution: game.solution, entries: game.startEntries }),
    )
  }, [restartWith])

  if (progress === null || save === null) return null
  return (
    <GameSaveContext value={save}>
      {/* A new id mounts a new game screen. A Game in start resumes as it was saved (startSession). */}
      <GameScreen key={progress.id} start={progress.game} onBack={home} onNewPuzzle={newPuzzle} onRetry={retry} />
    </GameSaveContext>
  )
}
