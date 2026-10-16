import { SegmentedControl } from '@/settings/components/SegmentedControl'
import type { ThemePreference } from '@/theme/preference'
import { THEME_NAMES, THEMES } from '@/theme/themes/registry'

type ThemePickerProps = { value: ThemePreference; onChange(preference: ThemePreference): void }

const OPTIONS = THEME_NAMES.map((name) => ({ value: name, label: THEMES[name].label }))

/** The colourway: Cobalt, Forest or Bordeaux (ADR-025). */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} indicatorTestID="theme-indicator" />
}
