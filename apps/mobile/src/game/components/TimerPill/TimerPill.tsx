import { Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { useGameTime } from '@/game/hooks/useGameTime'
import { formatClock } from '@/game/utils/time.utils'
import { styles } from './TimerPill.styles'

export function TimerPill() {
  const playedMs = useGameTime()
  return (
    <View style={styles.pill} accessibilityLabel={`Time ${formatClock(playedMs)}`}>
      <Text style={styles.time}>{formatClock(playedMs)}</Text>
      <Icon name="pause" tone="text" size={16} />
    </View>
  )
}
