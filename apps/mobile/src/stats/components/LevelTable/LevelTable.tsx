import { Text, View } from 'react-native'
import { LEVELS } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { NONE } from '@/stats/constants/stats.constants'
import { formatAverage, formatPercent, formatTime } from '@/stats/utils/format.utils'
import type { Level, LevelSummary } from '@/storage'
import { styles } from './LevelTable.styles'

type Row = { label: string; cell(summary: LevelSummary): string }

// Rows in the groups of the design: games, times, quality, abandoned. A level with no game shows a dash, except in the counts.
const GROUPS: readonly (readonly Row[])[] = [
  [
    { label: 'Played', cell: (s) => String(s.played) },
    { label: 'Win rate', cell: (s) => formatPercent(s.winRate) },
  ],
  [
    { label: 'Best time', cell: (s) => formatTime(s.bestMs) },
    { label: 'Average', cell: (s) => formatTime(s.averageMs) },
  ],
  [
    { label: 'Flawless', cell: (s) => (s.played === 0 ? NONE : String(s.flawlessWins)) },
    { label: 'Mistakes', cell: (s) => formatAverage(s.averageMistakes) },
    { label: 'Hints', cell: (s) => formatAverage(s.averageHints) },
  ],
  [{ label: 'Abandoned', cell: (s) => String(s.abandoned) }],
]

const NOTE =
  'Best time counts wins without hints. Average counts all wins. Mistakes and hints are per game. Flawless means a win with no mistakes and no hints. Abandoned games are not counted.'

type LevelTableProps = { levels: Record<Level, LevelSummary> }

/** All four levels side by side, so the player compares them without a tab change. */
export function LevelTable({ levels }: LevelTableProps) {
  return (
    <View role="table" style={styles.table}>
      <View style={styles.head}>
        <View style={styles.labelCell} />
        {LEVELS.map((level) => (
          <View key={level} accessible role="columnheader" accessibilityLabel={LEVEL_NAMES[level]} style={styles.cell}>
            <Text style={styles.headLabel}>{LEVEL_NAMES[level]}</Text>
          </View>
        ))}
      </View>
      {GROUPS.map((rows) => (
        <View key={rows[0]?.label} style={styles.group}>
          {rows.map(({ label, cell }) => (
            <View key={label} style={styles.row}>
              <View style={styles.labelCell}>
                <Text style={styles.rowLabel}>{label}</Text>
              </View>
              {LEVELS.map((level) => {
                const text = cell(levels[level])
                return (
                  <View
                    key={level}
                    accessible
                    accessibilityLabel={`${LEVEL_NAMES[level]}, ${label}: ${text}`}
                    style={styles.cell}
                  >
                    <Text style={[styles.value, text === NONE && styles.none]}>{text}</Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.note}>{NOTE}</Text>
    </View>
  )
}
