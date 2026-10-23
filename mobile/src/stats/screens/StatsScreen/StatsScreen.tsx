import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { AssistRow } from '@/settings/components/AssistRow'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import { DayStrip } from '@/stats/components/DayStrip'
import { LevelDetail } from '@/stats/components/LevelDetail'
import { LevelTable } from '@/stats/components/LevelTable'
import { LevelTabs } from '@/stats/components/LevelTabs'
import { StatRow } from '@/stats/components/StatRow'
import { StatSection } from '@/stats/components/StatSection'
import { ResetStats } from '@/stats/components/ResetStats'
import { StatsCard } from '@/stats/components/StatsCard'
import type { StatsTab } from '@/stats/constants/stats.constants'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { useStats, type StatsData } from '@/stats/hooks/useStats'
import { useIntl } from '@/i18n/hooks/useIntl'
import { isDevelopmentVariant } from '@/utils/appVariant.utils'
import { styles } from './StatsScreen.styles'

type StatsScreenProps = {
  onBack(): void
  /** Shown at the bottom of the scroll content. The route gives it, so this folder never imports the sync. */
  footer?: ReactNode
  /** A new value reads the numbers again, for example after a sync wrote entries. */
  refreshKey?: number
}

function Overview({ data }: { data: StatsData }) {
  const intl = useIntl()
  const days = (count: number) => intl.formatMessage({ id: 'stats.days' }, { count })
  return (
    <>
      <LevelTable levels={data.levels} />
      <StatSection
        title={intl.formatMessage({ id: 'stats.streak.title' })}
        note={intl.formatMessage({ id: 'stats.streak.note' })}
      >
        <StatRow label={intl.formatMessage({ id: 'stats.streak.current' })} value={days(data.streak.current)} />
        <StatRow label={intl.formatMessage({ id: 'stats.streak.longest' })} value={days(data.streak.longest)} />
        <View style={styles.stripHeader}>
          <Text style={styles.stripTitle}>
            {intl.formatMessage({ id: 'stats.strip.title' }, { count: data.streak.recent.length })}
          </Text>
          <Text style={styles.stripNote}>{intl.formatMessage({ id: 'stats.strip.note' })}</Text>
        </View>
        <DayStrip days={data.streak.recent} />
      </StatSection>
    </>
  )
}

/** The card of all levels, then a tab bar: the overview of all levels, or the detail of one level. */
export function StatsScreen({ onBack, footer, refreshKey = 0 }: StatsScreenProps) {
  const { theme } = useUnistyles()
  const [tab, setTab] = useState<StatsTab>('all')
  const { includeScanned, setIncludeScanned } = useIncludeScanned()
  const haptics = useHaptics()
  const intl = useIntl()
  const title = intl.formatMessage({ id: 'stats.title' })
  // A reset changes the key, so the numbers load again.
  const [reloadKey, setReloadKey] = useState(0)
  const state = useStats(includeScanned, reloadKey + refreshKey)
  // A theme with a title block shows a large title under the bar. The others put the title in the bar.
  const hasTitleBlock = theme.size.titleBlock > 0

  return (
    <Screen layout="flow">
      <ScreenHeader title={hasTitleBlock ? undefined : title} onBack={onBack} />
      {hasTitleBlock && (
        <View testID="title-block" style={styles.titleBlock}>
          <Text accessibilityRole="header" style={styles.display}>
            {title}
          </Text>
        </View>
      )}
      {state.status === 'failed' && (
        <Text style={styles.message}>{intl.formatMessage({ id: 'stats.loadFailed' })}</Text>
      )}
      {state.status === 'ready' && (
        <>
          <View style={styles.card}>
            <StatsCard winRate={state.data.overall.winRate} streak={state.data.streak.current} />
          </View>
          <LevelTabs
            value={tab}
            onChange={(next) => {
              haptics.play('tick')
              setTab(next)
            }}
          />
          {tab === 'all' ? (
            <Overview data={state.data} />
          ) : (
            <LevelDetail level={tab} summary={state.data.levels[tab]} times={state.data.times[tab]} />
          )}
          <View style={styles.settings}>
            <AssistRow
              label={intl.formatMessage({ id: 'stats.includeScanned.label' })}
              description={intl.formatMessage({ id: 'stats.includeScanned.description' })}
              value={includeScanned}
              onChange={(on) => {
                haptics.play('tick')
                setIncludeScanned(on)
              }}
            />
          </View>
          {isDevelopmentVariant() && <ResetStats onReset={() => setReloadKey((key) => key + 1)} />}
        </>
      )}
      {footer}
    </Screen>
  )
}
