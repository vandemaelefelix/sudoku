import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { useIntl } from '@/i18n/hooks/useIntl'
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

function strong(chunks: ReactNode[]) {
  return (
    <Text key="strong" style={styles.strong}>
      {chunks}
    </Text>
  )
}

/** The win rate and the day streak of all levels. */
export function StatsCard({ winRate, streak, onPress }: StatsCardProps) {
  const intl = useIntl()
  const rate = formatPercent(intl, winRate)
  const label =
    winRate === null
      ? intl.formatMessage({ id: 'stats.card.labelNone' }, { count: streak })
      : intl.formatMessage({ id: 'stats.card.label' }, { rate, count: streak })
  const content = (
    <>
      <ThemeDecoration slot="summaryEdge" />
      <View style={styles.row}>
        <View style={styles.rate}>
          <Text style={styles.value}>{rate}</Text>
          <Text style={styles.text}>{intl.formatMessage({ id: 'stats.card.won' })}</Text>
        </View>
        <View style={styles.streak}>
          <Text style={styles.text}>
            {intl.formatMessage(
              { id: 'stats.card.streak' },
              {
                count: streak,
                strong,
              },
            )}
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
      accessibilityLabel={intl.formatMessage({ id: 'stats.card.open' }, { label })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && pressedStyles.pressed]}
    >
      {content}
    </Pressable>
  )
}
