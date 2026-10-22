import { LANGUAGE_KEY, LANGUAGES } from '@/i18n/constants/locale.constants'
import type { SettingDefinition } from '@/settings/settingStore'

export type Language = (typeof LANGUAGES)[number]

/** system: follow the languages of iOS. */
export type LanguageChoice = 'system' | Language

/** One preferred language of the device, as expo-localization gives it. */
export type DeviceLocale = { languageTag: string; languageCode: string | null }

/** language: the catalogue. locale: the tag for numbers, dates and plurals. */
export type ResolvedLocale = { language: Language; locale: string }

function isLanguage(value: string | null): value is Language {
  return (LANGUAGES as readonly (string | null)[]).includes(value)
}

/**
 * The language of the app and its formatting locale (ADR-033, point 5). System takes the first device language that the app has,
 * else the first of LANGUAGES. The locale is the device tag of that language, for example nl-BE, else the language alone.
 */
export function resolveLocale(choice: LanguageChoice, device: readonly DeviceLocale[]): ResolvedLocale {
  const language =
    choice !== 'system' ? choice : (device.map((entry) => entry.languageCode).find(isLanguage) ?? LANGUAGES[0])
  const match = device.find((entry) => entry.languageCode === language)
  return { language, locale: match?.languageTag ?? language }
}

export const LANGUAGE_SETTING: SettingDefinition<LanguageChoice> = {
  key: LANGUAGE_KEY,
  area: 'i18n',
  label: 'language',
  parse: (value) => (isLanguage(value) ? value : 'system'),
  serialize: (value) => value,
}
