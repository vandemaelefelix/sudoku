import { SegmentedControl } from '@/settings/components/SegmentedControl'
import type { AppearancePreference } from '@/theme/preference'
import { APPEARANCE_OPTIONS } from './AppearancePicker.constants'

type AppearancePickerProps = { value: AppearancePreference; onChange(appearance: AppearancePreference): void }

/** The appearance: Auto follows the iOS setting, Light is a white page, Colour has the accent as the page (ADR-026). */
export function AppearancePicker({ value, onChange }: AppearancePickerProps) {
  return (
    <SegmentedControl
      options={APPEARANCE_OPTIONS}
      value={value}
      onChange={onChange}
      indicatorTestID="appearance-indicator"
    />
  )
}
