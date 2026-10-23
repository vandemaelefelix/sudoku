import { View } from 'react-native'
import type { NewGame, TechniqueId } from '@sudoku/core'
import { Board } from '@/game/components/Board'
import { Dock } from '@/game/components/Dock'
import { FinishCard } from '@/game/components/FinishCard'
import { GameOverSheet } from '@/game/components/GameOverSheet'
import { GameProvider } from '@/game/components/GameProvider'
import { Header } from '@/game/components/Header'
import { ThemeStatusBar } from '@/components/ThemeStatusBar'
import type { LeaveCallback } from '@/game/hooks/useLeave'
import type { FinishInfo } from '@/game/utils/finish.utils'
import { styles } from './GameScreen.styles'

type GameScreenProps = {
  start: NewGame
  /** The header back button and Back to home on the game over sheet. */
  onBack(): void
  /** New puzzle on the game over sheet. Without it, the sheet has no New puzzle button. */
  onNewPuzzle?: LeaveCallback | undefined
  /** Try this puzzle again on the game over sheet. Give the screen a new React key in this callback: a retry is a new game. */
  onRetry: LeaveCallback
  /** The level, source, seed and best time of the game. Without it, the screen shows no finish card. */
  finish?: FinishInfo | undefined
  /** "Learn more" on the hint card. The game stays mounted under the page, so the hint is still open after Back. */
  onLearnTechnique?: ((technique: TechniqueId) => void) | undefined
}

/**
 * The game screen of the design canvas. GameProvider reads start once. Give the screen a new React key for a new puzzle.
 * The screen reads no theme hook, so a theme switch does not render the grid again (ADR-015).
 */
export function GameScreen({ start, onBack, onNewPuzzle, onRetry, finish, onLearnTechnique }: GameScreenProps) {
  return (
    <GameProvider start={start}>
      <ThemeStatusBar />
      <View style={styles.screen}>
        <Header onBack={onBack} />
        <Board />
        <Dock onLearn={onLearnTechnique} />
        <GameOverSheet onRetry={onRetry} onNewPuzzle={onNewPuzzle} onHome={onBack} />
        {finish && <FinishCard info={finish} onNewPuzzle={onNewPuzzle} onHome={onBack} />}
      </View>
    </GameProvider>
  )
}
