import { Pressable, Text, View } from 'react-native'
import type { ThemePreference } from '@/theme/preference'
import { THEME_NAMES, THEMES } from '@/theme/themes/registry'
import { SYSTEM_LABEL } from './ThemePicker.constants'
import { styles } from './ThemePicker.styles'

type ThemePickerProps = { value: ThemePreference; onChange(preference: ThemePreference): void }

const OPTIONS: readonly { preference: ThemePreference; label: string }[] = [
  { preference: 'system', label: SYSTEM_LABEL },
  ...THEME_NAMES.map((name) => ({ preference: name, label: THEMES[name].label })),
]

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <View style={styles.track}>
      {OPTIONS.map(({ preference, label }) => {
        const selected = preference === value
        return (
          <Pressable
            key={preference}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(preference)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
