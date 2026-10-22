import { createAppIntl, type Formatter } from '@/i18n/utils/intl.utils'

let current: Formatter = createAppIntl('en')

/**
 * The formatter of the language of the player, for code outside React that raises an alert, such as the account lifecycle.
 * I18nProvider keeps it current. Until it mounts, and in a test without it, the formatter is English.
 */
export function currentIntl(): Formatter {
  return current
}

export function setCurrentIntl(intl: Formatter): void {
  current = intl
}
