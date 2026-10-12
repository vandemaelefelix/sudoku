import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

type Loaded = { progress: SavedProgress; best: BestTimes }

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
 * The best times load with the game, so the finish card compares against the best time before this game.
 */
export function PlayScreen() {
  const router = useRouter()
  const { puzzles, history } = useGameStorage()
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  const home = useCallback(() => router.dismissTo('/'), [router])

  useEffect(() => {
    let live = true
    Promise.all([puzzles.current(), history.bestTimes()])
      .then(([current, best]) => {
        if (!live) return
        if (current === null) home()
        else setLoaded({ progress: current, best })
      })
      .catch((error: unknown) => {
        devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`)
        home()
      })
    return () => {
      live = false
    }
  }, [puzzles, history, home])

  const progress = loaded?.progress ?? null
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
        setLoaded({ progress: started, best: await history.bestTimes() })
      } catch (error) {
        devWarn('storage', `The game does not start: ${errorMessage(error)}`)
      }
    },
    [puzzles, history, progress],
  )

  const newPuzzle = useCallback(() => {
    void restartWith('generated', (current) => newGeneratedGame(current.level, Math.random))
  }, [restartWith])

  const retry = useCallback(() => {
    if (progress === null) return
    void restartWith(progress.source, ({ game, seed }) => ({
      game: createGame({ givens: game.givens, solution: game.solution, entries: game.startEntries }),
      seed,
    }))
  }, [restartWith, progress])

  const finish = useMemo<FinishInfo | null>(
    () =>
      loaded === null
        ? null
        : {
            level: loaded.progress.level,
            source: loaded.progress.source,
            seed: loaded.progress.seed,
            bestBeforeMs: loaded.best[loaded.progress.level] ?? null,
          },
    [loaded],
  )

  if (progress === null || save === null || finish === null) return null
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
