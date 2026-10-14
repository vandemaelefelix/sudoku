import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Icon } from '@/game/components/Icon'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { AssistRow } from '@/settings/components/AssistRow'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { DayStrip } from '@/stats/components/DayStrip'
import { LevelDetail } from '@/stats/components/LevelDetail'
import { LevelTable } from '@/stats/components/LevelTable'
import { LevelTabs } from '@/stats/components/LevelTabs'
import { StatRow } from '@/stats/components/StatRow'
import { StatSection } from '@/stats/components/StatSection'
import { StatsCard } from '@/stats/components/StatsCard'
import type { StatsTab } from '@/stats/constants/stats.constants'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { useStats, type StatsData } from '@/stats/hooks/useStats'
import { countOf } from '@/stats/utils/format.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './StatsScreen.styles'

type StatsScreenProps = { onBack(): void }

function Overview({ data }: { data: StatsData }) {
  return (
    <>
      <LevelTable levels={data.levels} />
      <StatSection title="Streak" note="all levels">
        <StatRow label="Current" value={countOf(data.streak.current, 'day')} />
        <StatRow label="Longest" value={countOf(data.streak.longest, 'day')} />
        <View style={styles.stripHeader}>
          <Text style={styles.stripTitle}>Last 14 days</Text>
          <Text style={styles.stripNote}>today on the right</Text>
        </View>
        <DayStrip days={data.streak.recent} />
      </StatSection>
    </>
  )
}

/** The card of all levels, then a tab bar: the overview of all levels, or the detail of one level. */
export function StatsScreen({ onBack }: StatsScreenProps) {
  const { theme } = useUnistyles()
  const [tab, setTab] = useState<StatsTab>('all')
  const { includeScanned, setIncludeScanned } = useIncludeScanned()
  const haptics = useHaptics()
  const state = useStats(includeScanned)
  // A theme with a title block shows a large title under the bar. The others put the title in the bar.
  const hasTitleBlock = theme.size.titleBlock > 0

  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
          >
            <Icon name="back" tone="text" />
          </Pressable>
          {!hasTitleBlock && (
            <Text accessibilityRole="header" style={styles.barTitle}>
              Stats
            </Text>
          )}
        </View>
        {hasTitleBlock && (
          <View testID="title-block" style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.display}>
              Stats
            </Text>
          </View>
        )}
        {state.status === 'failed' && <Text style={styles.message}>The stats do not load.</Text>}
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
                label="Include scanned puzzles"
                description="A scanned level is an estimate."
                value={includeScanned}
                divider={false}
                onChange={(on) => {
                  haptics.play('tick')
                  setIncludeScanned(on)
                }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </>
  )
}
