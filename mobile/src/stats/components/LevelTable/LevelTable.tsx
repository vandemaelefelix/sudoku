import { Text, View } from 'react-native'
import { LEVELS } from '@sudoku/core'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import type { Formatter } from '@/i18n/utils/intl.utils'
import { NONE } from '@/stats/constants/stats.constants'
import { formatAverage, formatPercent, formatTime } from '@/stats/utils/format.utils'
import type { Level, LevelSummary } from '@/storage'
import { styles } from './LevelTable.styles'

type Row = { label: MessageId; cell(summary: LevelSummary, intl: Formatter): string }

// Rows in the groups of the design: games, times, quality, abandoned. A level with no game shows a dash, except in the counts.
const GROUPS: readonly (readonly Row[])[] = [
  [
    { label: 'stats.games.played', cell: (s, intl) => intl.formatNumber(s.played) },
    { label: 'stats.games.winRate', cell: (s, intl) => formatPercent(intl, s.winRate) },
  ],
  [
    { label: 'stats.table.bestTime', cell: (s) => formatTime(s.bestMs) },
    { label: 'stats.times.average', cell: (s) => formatTime(s.averageMs) },
  ],
  [
    { label: 'stats.table.flawless', cell: (s, intl) => (s.played === 0 ? NONE : intl.formatNumber(s.flawlessWins)) },
    { label: 'stats.games.mistakes', cell: (s, intl) => formatAverage(intl, s.averageMistakes) },
    { label: 'stats.games.hints', cell: (s, intl) => formatAverage(intl, s.averageHints) },
  ],
  [{ label: 'stats.games.abandoned', cell: (s, intl) => intl.formatNumber(s.abandoned) }],
]

type LevelTableProps = { levels: Record<Level, LevelSummary> }

/** All four levels side by side, so the player compares them without a tab change. */
export function LevelTable({ levels }: LevelTableProps) {
  const intl = useIntl()
  return (
    <View role="table" style={styles.table}>
      <View style={styles.head}>
        <View style={styles.labelCell} />
        {LEVELS.map((level) => {
          const name = intl.formatMessage({ id: LEVEL_LABELS[level] })
          return (
            <View key={level} accessible role="columnheader" accessibilityLabel={name} style={styles.cell}>
              <Text style={styles.headLabel}>{name}</Text>
            </View>
          )
        })}
      </View>
      {GROUPS.map((rows) => (
        <View key={rows[0]?.label} style={styles.group}>
          {rows.map(({ label: labelId, cell }) => {
            const label = intl.formatMessage({ id: labelId })
            return (
              <View key={labelId} style={styles.row}>
                <View style={styles.labelCell}>
                  <Text style={styles.rowLabel}>{label}</Text>
                </View>
                {LEVELS.map((level) => {
                  const text = cell(levels[level], intl)
                  return (
                    <View
                      key={level}
                      accessible
                      accessibilityLabel={intl.formatMessage(
                        { id: 'stats.table.cell' },
                        { level: intl.formatMessage({ id: LEVEL_LABELS[level] }), label, value: text },
                      )}
                      style={styles.cell}
                    >
                      <Text style={[styles.value, text === NONE && styles.none]}>{text}</Text>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      ))}
      <Text style={styles.note}>{intl.formatMessage({ id: 'stats.table.note' })}</Text>
    </View>
  )
}
