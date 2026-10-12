import { Pressable, Text, View } from 'react-native'
import type { ThemePreference } from '@/theme/preference'
import { THEME_OPTIONS } from './ThemePicker.constants'
import { styles } from './ThemePicker.styles'

type ThemePickerProps = { value: ThemePreference; onChange(preference: ThemePreference): void }

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <View style={styles.track}>
      {THEME_OPTIONS.map(({ preference, label }) => {
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
