import { Pressable, Text, View } from 'react-native'
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated'
import { useAnimatedTheme } from 'react-native-unistyles/reanimated'
import { formatClock } from '@sudoku/core'
import { Icon } from '@/game/components/Icon'
import { useEased } from '@/game/hooks/useEased'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './TimerPill.styles'

/** The time played. It is also the pause button, until the game ends. */
export function TimerPill() {
  const playedMs = useGameTime()
  const { status } = useGameState().board
  const time = formatClock(playedMs)
  if (status === 'lost' || status === 'won') {
    return (
      <View style={styles.area} accessible accessibilityLabel={`Time ${time}`}>
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
      style={({ pressed }) => [styles.area, pressed && pressedStyles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${paused ? 'Resume' : 'Pause'}, time ${time}`}
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
