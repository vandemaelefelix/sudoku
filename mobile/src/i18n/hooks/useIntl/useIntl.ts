import { useContext } from 'react'
import { createIntl, createIntlCache, IntlContext, type IntlShape } from 'react-intl'
import { DEFAULT_LOCALES } from '@/i18n/constants/locale.constants'
import { CATALOGUES } from '@/i18n/messages'

// The English formatter for a tree without I18nProvider. The app always has the provider at its root, so only a test that
// renders one component without it reads this.
const fallback = createIntl(
  { locale: DEFAULT_LOCALES.en, defaultLocale: 'en', messages: CATALOGUES.en },
  createIntlCache(),
)

/** The formatter of the language of the player (ADR-033). Every text of the app comes through it. */
export function useIntl(): IntlShape {
  return useContext(IntlContext) ?? fallback
}
