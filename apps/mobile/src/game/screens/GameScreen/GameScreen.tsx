import { View } from 'react-native'
import type { NewGame } from '@sudoku/core'
import { Board } from '@/game/components/Board'
import { GameProvider } from '@/game/components/GameProvider'
import { Header } from '@/game/components/Header'
import { Keypad } from '@/game/components/Keypad'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { Tools } from '@/game/components/Tools'
import { styles } from './GameScreen.styles'

type GameScreenProps = { start: NewGame; onBack(): void }

/**
 * The game screen of the design canvas. GameProvider reads start once. Give the screen a new React key for a new puzzle.
 * The screen reads no theme hook, so a theme switch does not render the grid again (ADR-015).
 */
export function GameScreen({ start, onBack }: GameScreenProps) {
  return (
    <GameProvider start={start}>
      <ThemeStatusBar />
      <View style={styles.screen}>
        <Header onBack={onBack} />
        <Board />
        <Tools />
        <Keypad />
      </View>
    </GameProvider>
  )
}
