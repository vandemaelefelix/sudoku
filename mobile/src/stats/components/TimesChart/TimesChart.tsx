import { Text, View } from 'react-native'
import { BAR_AREA, MIN_BAR } from '@/stats/constants/chart.constants'
import { TIMES_COUNT } from '@/stats/constants/stats.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import { formatTime, timeWords } from '@/stats/utils/format.utils'
import { styles } from './TimesChart.styles'

type TimesChartProps = { times: readonly number[] }

/** A bar for each of the last wins, oldest first. The fastest bar is solid and shows its time. */
export function TimesChart({ times }: TimesChartProps) {
  const intl = useIntl()
  if (times.length === 0) return null
  // Times of 0 give no scale: a bar then takes the minimum height.
  const slowest = Math.max(...times, 1)
  const fastest = Math.min(...times)
  const fastestIndex = times.indexOf(fastest)
  // The chart always has room for TIMES_COUNT bars: a lone win stays one narrow bar, and the newest bar stays on the right.
  const emptySlots = Math.max(0, TIMES_COUNT - times.length)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={intl.formatMessage(
        { id: 'stats.chart.label' },
        { count: times.length, fastest: timeWords(intl, fastest) },
      )}
      style={styles.chart}
    >
      {Array.from({ length: emptySlots }, (_, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the empty slots are one fixed run and never reorder.
        <View key={`empty-${index}`} testID="time-slot-empty" style={styles.slot} />
      ))}
      {times.map((ms, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the bars are one fixed row, and two wins can have the same time.
        <View key={index} style={styles.slot}>
          {index === fastestIndex && (
            <Text numberOfLines={1} style={styles.label}>
              {formatTime(ms)}
            </Text>
          )}
          <View
            testID="time-bar"
            style={[
              styles.bar,
              index === fastestIndex && styles.fastest,
              { height: Math.max(MIN_BAR, (ms / slowest) * BAR_AREA) },
            ]}
          />
        </View>
      ))}
    </View>
  )
}
