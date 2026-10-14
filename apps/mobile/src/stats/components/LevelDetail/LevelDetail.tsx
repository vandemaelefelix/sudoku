import { Text, View } from 'react-native'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { StatRow } from '@/stats/components/StatRow'
import { StatSection } from '@/stats/components/StatSection'
import { TimesChart } from '@/stats/components/TimesChart'
import { NONE } from '@/stats/constants/stats.constants'
import { countOf, formatAverage, formatPercent, formatTime } from '@/stats/utils/format.utils'
import type { Level, LevelSummary } from '@/storage'
import { styles } from './LevelDetail.styles'

type LevelDetailProps = { level: Level; summary: LevelSummary; times: readonly number[] }

/** The times and the game numbers of one level, or an empty state when the level has no game. */
export function LevelDetail({ level, summary, times }: LevelDetailProps) {
  if (summary.played === 0 && summary.abandoned === 0) {
    return (
      <View style={styles.empty}>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          No {LEVEL_NAMES[level]} games yet.
        </Text>
        <Text style={styles.emptyText}>Finish one and your win rate, best time and average time show up here.</Text>
      </View>
    )
  }
  return (
    <>
      <StatSection title="Times">
        <StatRow label="Best" note="no hints" value={formatTime(summary.bestMs)} />
        <StatRow label="Average" note="won games" value={formatTime(summary.averageMs)} />
        {times.length > 0 && (
          <>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Last {countOf(times.length, 'win')}</Text>
              <Text style={styles.chartNote}>newest on the right</Text>
            </View>
            <TimesChart times={times} />
          </>
        )}
      </StatSection>
      <StatSection title="Games">
        <StatRow label="Win rate" value={formatPercent(summary.winRate)} />
        <StatRow label="Played" note={`${summary.won} won, ${summary.lost} lost`} value={String(summary.played)} />
        <StatRow
          label="Flawless wins"
          note="no mistakes, no hints"
          value={summary.played === 0 ? NONE : String(summary.flawlessWins)}
        />
        <StatRow label="Mistakes" note="per game" value={formatAverage(summary.averageMistakes)} />
        <StatRow label="Hints" note="per game" value={formatAverage(summary.averageHints)} />
        <StatRow label="Abandoned" note="not counted" value={String(summary.abandoned)} />
      </StatSection>
    </>
  )
}
