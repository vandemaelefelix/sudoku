import { LANGUAGE_SETTING, resolveLocale } from './locale.utils'

const device = (...tags: string[]) => tags.map((tag) => ({ languageTag: tag, languageCode: tag.split('-')[0] ?? null }))

describe('resolveLocale', () => {
  it('follows the first iOS language that the app has, with the region of the device', () => {
    expect(resolveLocale('system', device('nl-BE', 'en-GB'))).toEqual({ language: 'nl', locale: 'nl-BE' })
  })

  it('skips an iOS language that the app does not have', () => {
    expect(resolveLocale('system', device('fr-BE', 'nl-BE'))).toEqual({ language: 'nl', locale: 'nl-BE' })
  })

  it('falls back to English when the app has none of the iOS languages', () => {
    expect(resolveLocale('system', device('fr-FR', 'de-DE'))).toEqual({ language: 'en', locale: 'en-GB' })
    expect(resolveLocale('system', [])).toEqual({ language: 'en', locale: 'en-GB' })
  })

  it('takes a fixed choice over the iOS language, with the device region when the languages match, else the Flemish default', () => {
    expect(resolveLocale('nl', device('en-GB'))).toEqual({ language: 'nl', locale: 'nl-BE' })
    expect(resolveLocale('en', device('nl-BE', 'en-GB'))).toEqual({ language: 'en', locale: 'en-GB' })
  })

  it('skips a device entry without a language code', () => {
    expect(resolveLocale('system', [{ languageTag: 'und', languageCode: null }, ...device('nl-NL')])).toEqual({
      language: 'nl',
      locale: 'nl-NL',
    })
  })
})

describe('LANGUAGE_SETTING', () => {
  it('reads the saved choice, and System for a missing or broken value', () => {
    expect(LANGUAGE_SETTING.parse('nl')).toBe('nl')
    expect(LANGUAGE_SETTING.parse('en')).toBe('en')
    expect(LANGUAGE_SETTING.parse(null)).toBe('system')
    expect(LANGUAGE_SETTING.parse('fr')).toBe('system')
  })

  it('saves the choice as its own text', () => {
    expect(LANGUAGE_SETTING.serialize('nl')).toBe('nl')
    expect(LANGUAGE_SETTING.serialize('system')).toBe('system')
  })
})
