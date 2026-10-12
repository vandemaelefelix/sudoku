import { Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { formatClock } from '@/game/utils/time.utils'
import { styles } from './TimerPill.styles'

/** The time played. The area has the size of a touch target but no action yet: the pill is not a button. */
export function TimerPill() {
  const playedMs = useGameTime()
  const { status } = useGameState().board
  const ended = status === 'lost' || status === 'won'
  const time = formatClock(playedMs)
  return (
    <View style={styles.area} accessible accessibilityLabel={`Time ${time}`}>
      <View testID="timer-pill" style={ended ? styles.endedPill : styles.pill}>
        <Text style={ended ? styles.endedTime : styles.time}>{time}</Text>
        {!ended && <Icon name="pause" tone="text" size={16} />}
      </View>
    </View>
  )
}
