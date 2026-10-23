import { Pressable, Text, View } from 'react-native'
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated'
import { useAnimatedTheme } from 'react-native-unistyles/reanimated'
import { formatClock } from '@sudoku/core'
import { Icon } from '@/components/Icon'
import { useEased } from '@/hooks/useEased'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './TimerPill.styles'
import { useIntl } from '@/i18n/hooks/useIntl'

/** The time played. It is also the pause button, until the game ends. */
export function TimerPill() {
  const intl = useIntl()
  const playedMs = useGameTime()
  const { status } = useGameState().board
  const time = formatClock(playedMs)
  if (status === 'lost' || status === 'won') {
    return (
      <View
        testID="timer"
        style={styles.area}
        accessible
        accessibilityLabel={intl.formatMessage({ id: 'game.time' }, { time })}
      >
        <View testID="timer-pill" style={styles.endedPill}>
          <Text style={styles.endedTime}>{time}</Text>
        </View>
      </View>
    )
  }
  return <PauseButton time={time} paused={status === 'paused'} />
}

/** The accent of a pause fades in behind the time, and the time and the icon follow, so the pill does not flash. */
function PauseButton({ time, paused }: { time: string; paused: boolean }) {
  const intl = useIntl()
  const { pause, resume } = useGameActions()
  const { play } = useHaptics()
  const theme = useAnimatedTheme()
  const face = useEased(paused ? 1 : 0)
  const fillStyle = useAnimatedStyle(() => ({ opacity: face.get() }))
  const pauseIconStyle = useAnimatedStyle(() => ({ opacity: 1 - face.get() }))
  const timeStyle = useAnimatedStyle(() => {
    const { text, onAccent } = theme.get().colors
    return { color: interpolateColor(face.get(), [0, 1], [text, onAccent]) }
  })
  const toggle = () => {
    play('soft')
    if (paused) resume()
    else pause()
  }
  return (
    <Pressable
      testID="timer"
      style={({ pressed }) => [styles.area, pressed && pressedStyles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage({ id: paused ? 'game.timer.resume' : 'game.timer.pause' }, { time })}
      onPress={toggle}
    >
      <View testID="timer-pill" style={styles.pill}>
        <Animated.View testID="timer-pill-fill" style={[styles.pausedFill, fillStyle]} pointerEvents="none" />
        <Animated.Text style={[styles.time, timeStyle]}>{time}</Animated.Text>
        <View style={styles.icon}>
          <Animated.View style={pauseIconStyle}>
            <Icon name="pause" tone="text" size={16} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, fillStyle]}>
            <Icon name="play" tone="onAccent" size={16} />
          </Animated.View>
        </View>
      </View>
    </Pressable>
  )
}
