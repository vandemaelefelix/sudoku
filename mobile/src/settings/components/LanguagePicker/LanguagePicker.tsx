import { useIntl } from '@/i18n/hooks/useIntl'
import type { LanguageChoice } from '@/i18n/utils/locale.utils'
import { SegmentedControl } from '@/components/SegmentedControl'
import { LANGUAGE_OPTIONS } from './LanguagePicker.constants'

type LanguagePickerProps = { value: LanguageChoice; onChange(choice: LanguageChoice): void }

/** The language: System follows iOS. English and Nederlands keep their own names in every language (ADR-033). */
export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  const intl = useIntl()
  const options = LANGUAGE_OPTIONS.map(({ value: choice, label }) => ({
    value: choice,
    label: intl.formatMessage({ id: label }),
  }))
  return <SegmentedControl options={options} value={value} onChange={onChange} testID="language" />
}
