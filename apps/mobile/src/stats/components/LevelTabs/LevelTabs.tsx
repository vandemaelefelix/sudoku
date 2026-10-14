import { Pressable, Text, View } from 'react-native'
import { LEVELS } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import type { StatsTab } from '@/stats/constants/stats.constants'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './LevelTabs.styles'

type LevelTabsProps = { value: StatsTab; onChange(tab: StatsTab): void }

const TABS: readonly { tab: StatsTab; label: string }[] = [
  { tab: 'all', label: 'All' },
  ...LEVELS.map((level) => ({ tab: level, label: LEVEL_NAMES[level] })),
]

/** One tab for the overview of all levels, and one for each level. */
export function LevelTabs({ value, onChange }: LevelTabsProps) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {TABS.map(({ tab, label }) => {
        const selected = tab === value
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && pressedStyles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
