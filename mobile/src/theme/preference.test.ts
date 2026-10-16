import { createMemorySettings } from '@/settings/memorySettings'
import {
  APPEARANCE_PREFERENCE_KEY,
  applyThemePreference,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  parseAppearancePreference,
  parseThemePreference,
  readAppearancePreference,
  readThemePreference,
  resolveAppearance,
  saveAppearancePreference,
  saveThemePreference,
  startupSettings,
  THEME_PREFERENCE_KEY,
  unistylesName,
} from './preference'

const runtime = () => ({ setTheme: jest.fn() })

describe('parseThemePreference', () => {
  it.each(['cobalt', 'forest', 'bordeaux'] as const)('keeps %s', (value) => {
    expect(parseThemePreference(value)).toBe(value)
  })
  it.each(['system', 'daylight', 'midnight', 'opart', 'progressive'])(
    'gives the default for %s, a value of an older version (ADR-025)',
    (value) => {
      expect(parseThemePreference(value)).toBe(DEFAULT_THEME)
    },
  )
  it.each([null, '', 'sepia', 'Cobalt', 'toString', 'light', 'cobalt-colour'])(
    'falls back to the default for %p',
    (value) => {
      expect(parseThemePreference(value)).toBe('cobalt')
    },
  )
})

describe('resolveAppearance', () => {
  it('gives Light and Colour as they are, whatever the system says', () => {
    for (const scheme of ['light', 'dark', null, undefined] as const) {
      expect(resolveAppearance('light', scheme)).toBe('light')
      expect(resolveAppearance('colour', scheme)).toBe('colour')
    }
  })
  it('gives Auto Light for a light system and Colour for a dark one', () => {
    expect(resolveAppearance('auto', 'light')).toBe('light')
    expect(resolveAppearance('auto', 'dark')).toBe('colour')
  })
  it('gives Auto Light when the system scheme is not known', () => {
    expect(resolveAppearance('auto', null)).toBe('light')
    expect(resolveAppearance('auto', undefined)).toBe('light')
  })
})

describe('parseAppearancePreference', () => {
  it.each(['auto', 'light', 'colour'] as const)('keeps %s', (value) => {
    expect(parseAppearancePreference(value)).toBe(value)
  })
  it.each([null, '', 'dark', 'Colour', 'Auto', 'color', 'toString', 'cobalt'])('gives light for %p', (value) => {
    expect(parseAppearancePreference(value)).toBe('light')
    expect(DEFAULT_APPEARANCE).toBe('light')
  })
})

describe('unistylesName', () => {
  it('names Light themes after the colourway and Colour themes with a suffix', () => {
    expect(unistylesName('cobalt', 'light')).toBe('cobalt')
    expect(unistylesName('forest', 'colour')).toBe('forest-colour')
    expect(unistylesName('bordeaux', 'colour')).toBe('bordeaux-colour')
  })
})

describe('startupSettings', () => {
  it.each(['cobalt', 'forest', 'bordeaux'] as const)('starts in %s Light, without adaptive themes', (name) => {
    expect(startupSettings(name, 'light', 'light')).toEqual({ initialTheme: name })
  })
  it.each(['cobalt', 'forest', 'bordeaux'] as const)('starts in %s Colour', (name) => {
    expect(startupSettings(name, 'colour', 'light')).toEqual({ initialTheme: `${name}-colour` })
  })
  it('resolves Auto with the system scheme before the first frame', () => {
    expect(startupSettings('forest', 'auto', 'light')).toEqual({ initialTheme: 'forest' })
    expect(startupSettings('forest', 'auto', 'dark')).toEqual({ initialTheme: 'forest-colour' })
    expect(startupSettings('forest', 'auto', null)).toEqual({ initialTheme: 'forest' })
  })
  it('ignores the system scheme for a fixed appearance', () => {
    expect(startupSettings('cobalt', 'light', 'dark')).toEqual({ initialTheme: 'cobalt' })
    expect(startupSettings('cobalt', 'colour', 'light')).toEqual({ initialTheme: 'cobalt-colour' })
  })
})

describe('applyThemePreference', () => {
  it('sets the theme of the colourway and the appearance', () => {
    const rt = runtime()
    applyThemePreference('bordeaux', 'light', rt)
    expect(rt.setTheme).toHaveBeenLastCalledWith('bordeaux')
    applyThemePreference('bordeaux', 'colour', rt)
    expect(rt.setTheme).toHaveBeenLastCalledWith('bordeaux-colour')
  })
})

describe('save and read the colourway', () => {
  it('saves the choice and applies it with the appearance', async () => {
    const settings = createMemorySettings()
    const rt = runtime()
    await saveThemePreference(settings, 'forest', 'colour', 'light', rt)
    expect(await settings.get(THEME_PREFERENCE_KEY)).toBe('forest')
    expect(rt.setTheme).toHaveBeenCalledWith('forest-colour')
    expect(readThemePreference(settings)).toBe('forest')
  })
  it('reads the default when nothing is saved', () => {
    expect(readThemePreference(createMemorySettings())).toBe('cobalt')
  })
  it('reads the default when the store throws, so the app still starts', () => {
    const settings = createMemorySettings()
    settings.getSync = () => {
      throw new Error('disk')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(readThemePreference(settings)).toBe('cobalt')
    expect(log).toHaveBeenCalledWith('[theme] saved theme unreadable: disk')
    log.mockRestore()
  })
  it('reads the default when the saved value is broken', () => {
    expect(readThemePreference(createMemorySettings({ [THEME_PREFERENCE_KEY]: 'sepia' }))).toBe('cobalt')
  })
  it('reads the default for the choice of an older version', () => {
    expect(readThemePreference(createMemorySettings({ [THEME_PREFERENCE_KEY]: 'midnight' }))).toBe('cobalt')
  })
})

describe('save and read the appearance', () => {
  it('saves the choice under its own key and applies it with the colourway', async () => {
    const settings = createMemorySettings()
    const rt = runtime()
    await saveAppearancePreference(settings, 'colour', 'forest', 'light', rt)
    expect(await settings.get(APPEARANCE_PREFERENCE_KEY)).toBe('colour')
    expect(await settings.get(THEME_PREFERENCE_KEY)).toBeNull()
    expect(rt.setTheme).toHaveBeenCalledWith('forest-colour')
    expect(readAppearancePreference(settings)).toBe('colour')
  })
  it('saves Auto as auto and applies the look of the system scheme', async () => {
    const settings = createMemorySettings()
    const rt = runtime()
    await saveAppearancePreference(settings, 'auto', 'bordeaux', 'dark', rt)
    expect(await settings.get(APPEARANCE_PREFERENCE_KEY)).toBe('auto')
    expect(rt.setTheme).toHaveBeenLastCalledWith('bordeaux-colour')
    await saveAppearancePreference(settings, 'auto', 'bordeaux', 'light', rt)
    expect(rt.setTheme).toHaveBeenLastCalledWith('bordeaux')
    expect(readAppearancePreference(settings)).toBe('auto')
  })
  it('reads light when nothing is saved, so a player of an older version sees no change', () => {
    expect(readAppearancePreference(createMemorySettings())).toBe('light')
  })
  it('reads light when the saved value is broken', () => {
    expect(readAppearancePreference(createMemorySettings({ [APPEARANCE_PREFERENCE_KEY]: 'dark' }))).toBe('light')
  })
  it('reads light when the store throws, so the app still starts', () => {
    const settings = createMemorySettings()
    settings.getSync = () => {
      throw new Error('disk')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(readAppearancePreference(settings)).toBe('light')
    expect(log).toHaveBeenCalledWith('[theme] saved appearance unreadable: disk')
    log.mockRestore()
  })
})
