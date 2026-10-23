import { LEVELS } from '@sudoku/core'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { SegmentedControl } from '@/components/SegmentedControl'
import type { StatsTab } from '@/stats/constants/stats.constants'

type LevelTabsProps = { value: StatsTab; onChange(tab: StatsTab): void }

const TABS: readonly { value: StatsTab; label: MessageId }[] = [
  { value: 'all', label: 'stats.tabs.all' },
  ...LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level] })),
]

/** One tab for the overview of all levels, and one for each level. It has the look of the segmented controls of Settings. */
export function LevelTabs({ value, onChange }: LevelTabsProps) {
  const intl = useIntl()
  const options = TABS.map((tab) => ({ value: tab.value, label: intl.formatMessage({ id: tab.label }) }))
  return <SegmentedControl kind="tabs" options={options} value={value} onChange={onChange} testID="level" />
}
