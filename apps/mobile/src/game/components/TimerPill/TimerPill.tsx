import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { formatClock } from '@/game/utils/time.utils'
import { styles } from './TimerPill.styles'

/** The time played. It is also the pause button, until the game ends. */
export function TimerPill() {
  const playedMs = useGameTime()
  const { status } = useGameState().board
  const { pause, resume } = useGameActions()
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
  const paused = status === 'paused'
  return (
    <Pressable
      style={styles.area}
      accessibilityRole="button"
      accessibilityLabel={`${paused ? 'Resume' : 'Pause'}, time ${time}`}
      onPress={paused ? resume : pause}
    >
      <View testID="timer-pill" style={paused ? styles.pausedPill : styles.pill}>
        <Text style={paused ? styles.pausedTime : styles.time}>{time}</Text>
        <Icon name={paused ? 'play' : 'pause'} tone={paused ? 'onAccent' : 'text'} size={16} />
      </View>
    </Pressable>
  )
}
