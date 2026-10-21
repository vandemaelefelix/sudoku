import { useCallback, useEffect, useRef } from 'react'
import { AccessibilityInfo, Pressable, Text } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { formatClock, GRID_CELLS, type Game } from '@sudoku/core'
import { useGameState } from '@/game/hooks/useGameState'
import { useLeave, type LeaveCallback } from '@/game/hooks/useLeave'
import { useHold } from '@/game/hooks/useHold'
import { useGameTime } from '@/game/hooks/useGameTime'
import { rightCells } from '@/game/utils/result.utils'
import { easeOut } from '@/utils/motion.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { LOST_HOLD_MS, RISE_OFFSET } from './GameOverSheet.constants'
import { styles } from './GameOverSheet.styles'

type GameOverSheetProps = {
  onRetry: LeaveCallback
  /** Without it, the sheet has no New puzzle button. */
  onNewPuzzle?: LeaveCallback | undefined
  onHome(): void
}

/**
 * Renders nothing until the game is lost and LOST_HOLD_MS has passed. This gate reads no time and no theme, so a tick or
 * a theme switch does not render it.
 */
export function GameOverSheet(props: GameOverSheetProps) {
  const { board } = useGameState()
  const shown = useHold(board.status === 'lost', LOST_HOLD_MS)
  if (!shown) return null
  return <Sheet board={board} {...props} />
}

function Sheet({ board, onRetry, onNewPuzzle, onHome }: GameOverSheetProps & { board: Game }) {
  const time = formatClock(useGameTime())
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const title = useRef<Text>(null)
  // The modal scrim hides the grid, but VoiceOver focus stays on the key that ended the game.
  const focusTitle = useCallback(() => {
    if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus')
  }, [])
  // 1 is the start of the rise and 0 its end. With Reduce Motion the sheet starts at its end.
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    if (reduceMotion) {
      focusTitle()
      return
    }
    rise.set(
      withTiming(0, { duration: theme.motion.medium, easing: easeOut }, (finished) => {
        if (finished) scheduleOnRN(focusTitle)
      }),
    )
  }, [focusTitle, reduceMotion, rise, theme.motion.medium])
  // The sheet sinks before the new game shows. The game-screen route takes Back to home away.
  const { leaveThen, guard } = useLeave(rise)
  // The scrim fades with the rise, so the board does not go dark before the sheet arrives.
  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - rise.value }))
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value * RISE_OFFSET }] }))
  return (
    <Animated.View testID="game-over" style={[styles.scrim, fadeStyle]} accessibilityViewIsModal>
      <Animated.View testID="game-over-sheet" style={[styles.sheet, riseStyle]}>
        <Text ref={title} accessibilityRole="header" style={styles.title}>
          Out of mistakes
        </Text>
        <Text style={styles.body}>
          {`Three wrong numbers end this game. You had ${rightCells(board)} of ${GRID_CELLS} cells right after ${time}.`}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => leaveThen(onRetry)}
          style={({ pressed }) => [styles.retry, pressed && pressedStyles.pressed]}
        >
          <Text style={styles.retryText}>Try this puzzle again</Text>
        </Pressable>
        {onNewPuzzle && (
          <Pressable
            accessibilityRole="button"
            onPress={() => leaveThen(onNewPuzzle)}
            style={({ pressed }) => [styles.newPuzzle, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.newPuzzleText}>New puzzle</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => guard(onHome)}
          style={({ pressed }) => [styles.home, pressed && pressedStyles.pressed]}
        >
          <Text style={styles.homeText}>Back to home</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
