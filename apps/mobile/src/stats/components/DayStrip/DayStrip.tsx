import { View } from 'react-native'
import { countOf } from '@/stats/utils/format.utils'
import { styles } from './DayStrip.styles'

type DayStripProps = { days: readonly boolean[] }

/** A square for each day, oldest first. A solid square is a day with a win. Today without a win yet is dashed. */
export function DayStrip({ days }: DayStripProps) {
  const wins = days.filter(Boolean).length
  const todayOpen = days.length > 0 && days[days.length - 1] === false
  const label = `Last ${days.length} days: wins on ${countOf(wins, 'day')}.${todayOpen ? ' Today has no win yet.' : ''}`
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
