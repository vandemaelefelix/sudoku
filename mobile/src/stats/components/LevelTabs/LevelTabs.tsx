import { LEVELS } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { SegmentedControl } from '@/settings/components/SegmentedControl'
import type { StatsTab } from '@/stats/constants/stats.constants'

type LevelTabsProps = { value: StatsTab; onChange(tab: StatsTab): void }

const TABS: readonly { value: StatsTab; label: string }[] = [
  { value: 'all', label: 'All' },
  ...LEVELS.map((level) => ({ value: level, label: LEVEL_NAMES[level] })),
]

/** One tab for the overview of all levels, and one for each level. It has the look of the segmented controls of Settings. */
export function LevelTabs({ value, onChange }: LevelTabsProps) {
  return <SegmentedControl kind="tabs" options={TABS} value={value} onChange={onChange} testID="level" />
}
