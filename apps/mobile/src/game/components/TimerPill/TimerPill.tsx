import { Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { useGame } from '@/game/hooks/useGame'
import { formatClock } from '@/game/utils/time.utils'
import { styles } from './TimerPill.styles'

export function TimerPill() {
  const { game } = useGame()
  return (
    <View style={styles.pill} accessibilityLabel={`Time ${formatClock(game.playedMs)}`}>
      <Text style={styles.time}>{formatClock(game.playedMs)}</Text>
      <Icon name="pause" tone="text" size={16} />
    </View>
  )
}
