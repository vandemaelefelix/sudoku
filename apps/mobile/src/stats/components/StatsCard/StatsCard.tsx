import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { formatPercent } from '@/stats/utils/format.utils'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './StatsCard.styles'

type StatsCardProps = {
  winRate: number | null
  streak: number
  /** The home screen gives it, to open the stats. The stats screen shows the card without it. */
  onPress?: () => void
}

/** The win rate and the day streak of all levels. */
export function StatsCard({ winRate, streak, onPress }: StatsCardProps) {
  const label =
    winRate === null ? `No games finished, ${streak} day streak` : `${formatPercent(winRate)} won, ${streak} day streak`
  const content = (
    <>
      <ThemeDecoration slot="summaryEdge" />
      <View style={styles.row}>
        <View style={styles.rate}>
          <Text style={styles.value}>{formatPercent(winRate)}</Text>
          <Text style={styles.text}>won</Text>
        </View>
        <View style={styles.streak}>
          <Text style={styles.text}>
            <Text style={styles.strong}>{streak}</Text> day streak
          </Text>
          {onPress !== undefined && <Icon name="next" tone="accent" size={16} />}
        </View>
      </View>
    </>
  )
  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={label} style={styles.card}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open stats`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && pressedStyles.pressed]}
    >
      {content}
    </Pressable>
  )
}
