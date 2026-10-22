import { createIntl, createIntlCache, type IntlShape } from '@formatjs/intl'
import { CATALOGUES } from '@/i18n/messages'
import type { Language } from './locale.utils'

/** The part of the formatter that a util needs. A util gets it as a parameter, so it imports no React (ADR-033). */
export type Formatter = Pick<IntlShape, 'formatMessage' | 'formatNumber' | 'formatDate' | 'locale'>

const cache = createIntlCache()

/** A formatter outside React: for a test of a util, and for the fallback of useIntl. locale: the formatting tag, for example nl-BE. */
export function createAppIntl(language: Language, locale: string = language): IntlShape {
  return createIntl({ locale, defaultLocale: 'en', messages: CATALOGUES[language] }, cache)
}
