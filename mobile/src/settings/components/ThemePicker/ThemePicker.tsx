import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { SegmentedControl } from '@/settings/components/SegmentedControl'
import type { ThemeName } from '@/theme/theme.types'
import type { ThemePreference } from '@/theme/preference'
import { THEME_NAMES } from '@/theme/themes/registry'

type ThemePickerProps = { value: ThemePreference; onChange(preference: ThemePreference): void }

const LABELS: Readonly<Record<ThemeName, MessageId>> = {
  cobalt: 'settings.theme.cobalt',
  forest: 'settings.theme.forest',
  bordeaux: 'settings.theme.bordeaux',
}

/** The colourway: Cobalt, Forest or Bordeaux (ADR-025). */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const intl = useIntl()
  const options = THEME_NAMES.map((name) => ({ value: name, label: intl.formatMessage({ id: LABELS[name] }) }))
  return <SegmentedControl options={options} value={value} onChange={onChange} testID="theme" />
}
