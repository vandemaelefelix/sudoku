import { useLocales } from 'expo-localization'
import type { ReactNode } from 'react'
import { IntlProvider } from 'react-intl'
import { Text } from 'react-native'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { CATALOGUES } from '@/i18n/messages'
import { resolveLocale } from '@/i18n/utils/locale.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'

function warn(error: unknown): void {
  devWarn('i18n', errorMessage(error))
}

/**
 * The messages and the formatting locale of the language choice (ADR-033). System follows the languages of iOS. A new choice
 * renders the app again in the new language at once. The tree stays mounted, so the navigation keeps its place.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { choice } = useLanguage()
  const device = useLocales()
  const { language, locale } = resolveLocale(choice, device)
  return (
    <IntlProvider
      locale={locale}
      defaultLocale="en"
      messages={CATALOGUES[language]}
      textComponent={Text}
      onError={warn}
    >
      {children}
    </IntlProvider>
  )
}
