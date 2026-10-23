import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { View } from 'react-native'
import type { TechniqueId } from '@sudoku/core'
import { GameSaveContext } from '@/game/hooks/useGameSession'
import { useBestTimes } from '@/game/hooks/useBestTimes'
import { usePlayProgress } from '@/game/hooks/usePlayProgress'
import { usePuzzleStart } from '@/game/hooks/usePuzzleStart'
import { useSaveQueue } from '@/game/hooks/useSaveQueue'
import { GameScreen } from '@/game/screens/GameScreen'
import type { SavedProgress } from '@/storage'
import { styles } from './PlayScreen.styles'

/** The game in progress, with its save queue and its best times. See usePlayProgress. */
export function PlayScreen() {
  const router = useRouter()
  const puzzleStart = usePuzzleStart()
  const home = useCallback(() => router.dismissTo('/'), [router])
  const learn = useCallback(
    (technique: TechniqueId) => router.push({ pathname: '/techniques/[technique]', params: { technique } }),
    [router],
  )
  const { progress, setProgress } = usePlayProgress(home)
  const { finish, reload } = useBestTimes(progress)
  const save = useSaveQueue(progress?.id)

  // Each restart is a new game in progress with a new id: save() moved a lost game to the history,
  // so the store ignores later saves under the old id. A failed start keeps the old screen.
  const show = useCallback(
    async (started: SavedProgress | null) => {
      if (started === null) return
      setProgress(started)
      await reload()
    },
    [setProgress, reload],
  )

  // The promises let the sheet rise again when the start fails.
  const newPuzzle = useCallback(async () => {
    if (progress !== null) await show(await puzzleStart.newPuzzle(progress))
  }, [puzzleStart, show, progress])

  const retry = useCallback(async () => {
    if (progress !== null) await show(await puzzleStart.retry(progress))
  }, [puzzleStart, show, progress])

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
        onLearnTechnique={learn}
      />
    </GameSaveContext>
  )
}
