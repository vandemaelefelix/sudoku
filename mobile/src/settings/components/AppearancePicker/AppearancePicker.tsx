import { useIntl } from '@/i18n/hooks/useIntl'
import { SegmentedControl } from '@/settings/components/SegmentedControl'
import type { AppearancePreference } from '@/theme/preference'
import { APPEARANCE_OPTIONS } from './AppearancePicker.constants'

type AppearancePickerProps = { value: AppearancePreference; onChange(appearance: AppearancePreference): void }

/** The appearance: Auto follows the iOS setting, Light is a white page, Colour has the accent as the page (ADR-026). */
export function AppearancePicker({ value, onChange }: AppearancePickerProps) {
  const intl = useIntl()
  const options = APPEARANCE_OPTIONS.map((option) => ({
    value: option.value,
    label: intl.formatMessage({ id: option.label }),
  }))
  return <SegmentedControl options={options} value={value} onChange={onChange} testID="appearance" />
}
