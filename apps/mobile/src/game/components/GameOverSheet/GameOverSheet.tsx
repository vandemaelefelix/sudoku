import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { GRID_CELLS, type Game } from '@sudoku/core'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { rightCells } from '@/game/utils/result.utils'
import { formatClock } from '@/game/utils/time.utils'
import { RISE_OFFSET } from './GameOverSheet.constants'
import { styles } from './GameOverSheet.styles'

type GameOverSheetProps = {
  onRetry(): void
  /** Without it, the sheet has no New puzzle button. */
  onNewPuzzle?: (() => void) | undefined
  onHome(): void
}

/** Renders nothing until the game is lost. This gate reads no time and no theme, so a tick or a theme switch does not render it. */
export function GameOverSheet(props: GameOverSheetProps) {
  const { board } = useGameState()
  if (board.status !== 'lost') return null
  return <Sheet board={board} {...props} />
}

function Sheet({ board, onRetry, onNewPuzzle, onHome }: GameOverSheetProps & { board: Game }) {
  const time = formatClock(useGameTime())
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  // 1 is the start of the rise and 0 its end. With Reduce Motion the sheet starts at its end.
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    if (reduceMotion) return
    rise.set(withTiming(0, { duration: theme.motion.medium, easing: Easing.out(Easing.quad) }))
  }, [reduceMotion, rise, theme.motion.medium])
  const title = useRef<Text>(null)
  useEffect(() => {
    // The modal scrim hides the grid, but VoiceOver focus stays on the key that ended the game.
    if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus')
  }, [])
  const riseStyle = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: rise.value * RISE_OFFSET }],
  }))
  return (
    <View testID="game-over" style={styles.scrim} accessibilityViewIsModal>
      <Animated.View testID="game-over-sheet" style={[styles.sheet, riseStyle]}>
        <Text ref={title} accessibilityRole="header" style={styles.title}>
          Out of mistakes
        </Text>
        <Text style={styles.body}>
          {`Three wrong numbers end this game. You had ${rightCells(board)} of ${GRID_CELLS} cells right after ${time}.`}
        </Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Try this puzzle again</Text>
        </Pressable>
        {onNewPuzzle && (
          <Pressable accessibilityRole="button" onPress={onNewPuzzle} style={styles.newPuzzle}>
            <Text style={styles.newPuzzleText}>New puzzle</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onHome} style={styles.home}>
          <Text style={styles.homeText}>Back to home</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}
