import { shouldPolyfill as needsCanonicalLocales } from '@formatjs/intl-getcanonicallocales/should-polyfill.js'
import { shouldPolyfill as needsLocale } from '@formatjs/intl-locale/should-polyfill.js'
import { shouldPolyfill as needsPluralRules } from '@formatjs/intl-pluralrules/should-polyfill.js'
import { LANGUAGES } from '@/i18n/constants/locale.constants'
import { devLog } from '@/utils/log.utils'

type IntlChecks = {
  getCanonicalLocales: () => boolean
  locale: () => boolean
  /** Gives the locale to load, or undefined when the runtime has its plural rules. */
  pluralRules: (locale: string) => string | undefined
}

const RUNTIME: IntlChecks = {
  getCanonicalLocales: needsCanonicalLocales,
  locale: needsLocale,
  pluralRules: needsPluralRules,
}

/** The Intl APIs that FormatJS needs and the runtime lacks (ADR-033, point 6). Hermes on iOS may lack some. */
export function missingIntl(checks: IntlChecks = RUNTIME): string[] {
  const missing: string[] = []
  if (checks.getCanonicalLocales()) missing.push('getCanonicalLocales')
  if (checks.locale()) missing.push('Locale')
  if (LANGUAGES.some((language) => checks.pluralRules(language) !== undefined)) missing.push('PluralRules')
  return missing
}

// Read before ./polyfills loads, so the log tells what the runtime lacked, not what the polyfills added.
const missingAtStart = missingIntl()

export function logIntlSupport(): void {
  devLog('i18n', missingAtStart.length === 0 ? 'Intl is complete' : `polyfilled: ${missingAtStart.join(', ')}`)
}
