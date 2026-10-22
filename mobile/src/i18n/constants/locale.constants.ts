/** The languages of the app, the first is the fallback. A third language adds a catalogue and a word list (ADR-033). */
export const LANGUAGES = ['en', 'nl'] as const

/**
 * The formatting locale of a language when no device language matches it. The app comes from Flanders, and en-GB writes the
 * dates of the design: "12 Oct 2026".
 */
export const DEFAULT_LOCALES = { en: 'en-GB', nl: 'nl-BE' } as const

/** The SettingsRepository key of the language choice. */
export const LANGUAGE_KEY = 'app.language'
