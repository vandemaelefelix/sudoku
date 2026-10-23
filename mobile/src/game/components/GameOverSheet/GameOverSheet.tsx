import { useCallback, useRef } from 'react'
import { AccessibilityInfo, Pressable, Text } from 'react-native'
import Animated from 'react-native-reanimated'
import { formatClock, GRID_CELLS, type Game } from '@sudoku/core'
import { useGameState } from '@/game/hooks/useGameState'
import { useLeave, type LeaveCallback } from '@/game/hooks/useLeave'
import { useHold } from '@/game/hooks/useHold'
import { useSheetRise } from '@/game/hooks/useSheetRise'
import { useGameTime } from '@/game/hooks/useGameTime'
import { rightCells } from '@/game/utils/result.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { pressedStyles } from '@/theme/pressed.styles'
import { GAME_OVER_RISE_OFFSET, LOST_HOLD_MS } from './GameOverSheet.constants'
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
  const intl = useIntl()
  const title = useRef<Text>(null)
  // The modal scrim hides the grid, but VoiceOver focus stays on the key that ended the game.
  const focusTitle = useCallback(() => {
    if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus')
  }, [])
  const { rise, fadeStyle, riseStyle } = useSheetRise(focusTitle, GAME_OVER_RISE_OFFSET)
  // The sheet sinks before the new game shows. The game-screen route takes Back to home away.
  const { leaveThen, guard } = useLeave(rise)
  return (
    <Animated.View testID="game-over" style={[styles.scrim, fadeStyle]} accessibilityViewIsModal>
      <Animated.View testID="game-over-sheet" style={[styles.sheet, riseStyle]}>
        <Text ref={title} accessibilityRole="header" style={styles.title}>
          {intl.formatMessage({ id: 'game.over.title' })}
        </Text>
        <Text style={styles.body}>
          {intl.formatMessage({ id: 'game.over.text' }, { right: rightCells(board), total: GRID_CELLS, time })}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => leaveThen(onRetry)}
          style={({ pressed }) => [styles.retry, pressed && pressedStyles.pressed]}
        >
          <Text style={styles.retryText}>{intl.formatMessage({ id: 'game.over.retry' })}</Text>
        </Pressable>
        {onNewPuzzle && (
          <Pressable
            accessibilityRole="button"
            onPress={() => leaveThen(onNewPuzzle)}
            style={({ pressed }) => [styles.newPuzzle, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.newPuzzleText}>{intl.formatMessage({ id: 'game.newPuzzle' })}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => guard(onHome)}
          style={({ pressed }) => [styles.home, pressed && pressedStyles.pressed]}
        >
          <Text style={styles.homeText}>{intl.formatMessage({ id: 'common.backHome' })}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
