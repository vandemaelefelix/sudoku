import type { MessageId } from '@/i18n/messages'
import type { LanguageChoice } from '@/i18n/utils/locale.utils'

export const LANGUAGE_OPTIONS: readonly { value: LanguageChoice; label: MessageId }[] = [
  { value: 'system', label: 'settings.language.system' },
  { value: 'en', label: 'settings.language.en' },
  { value: 'nl', label: 'settings.language.nl' },
]
