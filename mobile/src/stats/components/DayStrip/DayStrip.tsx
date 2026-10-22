import { View } from 'react-native'
import { useIntl } from '@/i18n/hooks/useIntl'
import { styles } from './DayStrip.styles'

type DayStripProps = { days: readonly boolean[] }

/** A square for each day, oldest first. A solid square is a day with a win. Today without a win yet is dashed. */
export function DayStrip({ days }: DayStripProps) {
  const intl = useIntl()
  const wins = days.filter(Boolean).length
  const todayOpen = days.length > 0 && days[days.length - 1] === false
  const summary = intl.formatMessage({ id: 'stats.strip.label' }, { total: days.length, count: wins })
  const label = todayOpen ? `${summary} ${intl.formatMessage({ id: 'stats.strip.todayOpen' })}` : summary
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.strip}>
      {days.map((won, index) => (
        <View
          // oxlint-disable-next-line react/no-array-index-key -- the squares are one fixed row and never reorder.
          key={index}
          testID="day-square"
          style={[styles.square, won && styles.won, !won && index === days.length - 1 && styles.pending]}
        />
      ))}
    </View>
  )
}
