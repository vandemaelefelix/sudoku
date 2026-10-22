import { Text, View } from 'react-native'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { StatRow } from '@/stats/components/StatRow'
import { StatSection } from '@/stats/components/StatSection'
import { TimesChart } from '@/stats/components/TimesChart'
import { NONE } from '@/stats/constants/stats.constants'
import { formatAverage, formatPercent, formatTime } from '@/stats/utils/format.utils'
import type { Level, LevelSummary } from '@/storage'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { styles } from './LevelDetail.styles'

type LevelDetailProps = { level: Level; summary: LevelSummary; times: readonly number[] }

/** The times and the game numbers of one level, or an empty state when the level has no game. */
export function LevelDetail({ level, summary, times }: LevelDetailProps) {
  const intl = useIntl()
  const t = (id: MessageId) => intl.formatMessage({ id })
  if (summary.played === 0 && summary.abandoned === 0) {
    return (
      <View style={styles.empty}>
        <ThemeDecoration slot="summaryEdge" />
        <View style={styles.emptyBody}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>
            {intl.formatMessage({ id: 'stats.level.emptyTitle' }, { level: t(LEVEL_LABELS[level]) })}
          </Text>
          <Text style={styles.emptyText}>{t('stats.level.emptyText')}</Text>
        </View>
      </View>
    )
  }
  return (
    <>
      <StatSection title={t('stats.times.title')}>
        <StatRow label={t('stats.times.best')} note={t('stats.note.noHints')} value={formatTime(summary.bestMs)} />
        <StatRow
          label={t('stats.times.average')}
          note={t('stats.note.noHints')}
          value={formatTime(summary.averageMs)}
        />
        {times.length > 0 && (
          <>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>
                {intl.formatMessage({ id: 'stats.chart.title' }, { count: times.length })}
              </Text>
              <Text style={styles.chartNote}>{t('stats.chart.note')}</Text>
            </View>
            <TimesChart times={times} />
          </>
        )}
      </StatSection>
      <StatSection title={t('stats.games.title')}>
        <StatRow label={t('stats.games.winRate')} value={formatPercent(intl, summary.winRate)} />
        <StatRow
          label={t('stats.games.played')}
          note={intl.formatMessage({ id: 'stats.games.wonLost' }, { won: summary.won, lost: summary.lost })}
          value={intl.formatNumber(summary.played)}
        />
        <StatRow
          label={t('stats.games.flawlessWins')}
          note={t('stats.note.flawless')}
          value={summary.played === 0 ? NONE : intl.formatNumber(summary.flawlessWins)}
        />
        <StatRow
          label={t('stats.games.mistakes')}
          note={t('stats.note.perGame')}
          value={formatAverage(intl, summary.averageMistakes)}
        />
        <StatRow
          label={t('stats.games.hints')}
          note={t('stats.note.perGame')}
          value={formatAverage(intl, summary.averageHints)}
        />
        <StatRow
          label={t('stats.games.abandoned')}
          note={t('stats.note.notCounted')}
          value={intl.formatNumber(summary.abandoned)}
        />
      </StatSection>
    </>
  )
}
