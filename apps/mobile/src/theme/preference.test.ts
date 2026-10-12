import { createMemorySettings } from '@/settings/memorySettings'
import {
  applyThemePreference,
  parseThemePreference,
  readThemePreference,
  saveThemePreference,
  startupSettings,
  THEME_PREFERENCE_KEY,
} from './preference'

const runtime = () => ({ setAdaptiveThemes: jest.fn(), setTheme: jest.fn() })

describe('parseThemePreference', () => {
  it.each(['system', 'daylight', 'midnight'] as const)('keeps %s', (value) => {
    expect(parseThemePreference(value)).toBe(value)
  })
  it.each([null, '', 'sepia', 'Daylight'])('falls back to system for %p', (value) => {
    expect(parseThemePreference(value)).toBe('system')
  })
})

describe('startupSettings', () => {
  it('follows the system for system', () => {
    expect(startupSettings('system')).toEqual({ adaptiveThemes: true })
  })
  it('starts in the saved theme, without adaptive themes', () => {
    expect(startupSettings('daylight')).toEqual({ initialTheme: 'light' })
    expect(startupSettings('midnight')).toEqual({ initialTheme: 'dark' })
  })
})

describe('applyThemePreference', () => {
  it('turns adaptive themes on for system and sets no theme', () => {
    const rt = runtime()
    applyThemePreference('system', rt)
    expect(rt.setAdaptiveThemes).toHaveBeenCalledWith(true)
    expect(rt.setTheme).not.toHaveBeenCalled()
  })
  it('turns adaptive themes off before it sets a theme, because setTheme throws while they are on', () => {
    const rt = runtime()
    const calls: string[] = []
    rt.setAdaptiveThemes.mockImplementation((on: boolean) => calls.push(`adaptive:${on}`))
    rt.setTheme.mockImplementation((name: string) => calls.push(`theme:${name}`))
    applyThemePreference('midnight', rt)
    expect(calls).toEqual(['adaptive:false', 'theme:dark'])
  })
})

describe('save and read', () => {
  it('saves the choice and applies it', async () => {
    const settings = createMemorySettings()
    const rt = runtime()
    await saveThemePreference(settings, 'daylight', rt)
    expect(await settings.get(THEME_PREFERENCE_KEY)).toBe('daylight')
    expect(rt.setTheme).toHaveBeenCalledWith('light')
    expect(readThemePreference(settings)).toBe('daylight')
  })
  it('reads system when nothing is saved', () => {
    expect(readThemePreference(createMemorySettings())).toBe('system')
  })
  it('reads system when the store throws, so the app still starts', () => {
    const settings = createMemorySettings()
    settings.getSync = () => {
      throw new Error('disk')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(readThemePreference(settings)).toBe('system')
    expect(log).toHaveBeenCalledWith('[theme] saved theme unreadable: disk')
    log.mockRestore()
  })
  it('reads system when the saved value is broken', () => {
    expect(readThemePreference(createMemorySettings({ [THEME_PREFERENCE_KEY]: 'sepia' }))).toBe('system')
  })
})
