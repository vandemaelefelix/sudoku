import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { NewGame } from '@sudoku/core'
import { Board } from '@/game/components/Board'
import { GameProvider } from '@/game/components/GameProvider'
import { Header } from '@/game/components/Header'
import { Keypad } from '@/game/components/Keypad'
import { Tools } from '@/game/components/Tools'
import { styles } from './GameScreen.styles'

type GameScreenProps = { start: NewGame; onBack(): void }

/** The game screen of the design canvas. start is read once: a new puzzle needs a new key. */
export function GameScreen({ start, onBack }: GameScreenProps) {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  return (
    <GameProvider start={start}>
      <StatusBar style={theme.statusBar} />
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + theme.space.lg }]}>
        <Header onBack={onBack} />
        <Board />
        <Tools />
        <Keypad />
      </View>
    </GameProvider>
  )
}
