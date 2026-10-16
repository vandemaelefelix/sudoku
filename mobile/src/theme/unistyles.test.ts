import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'
import { APP_THEMES } from './unistyles'
import { bordeaux, bordeauxColour } from '@/theme/themes/bordeaux'
import { cobalt, cobaltColour } from '@/theme/themes/cobalt'
import { forest, forestColour } from '@/theme/themes/forest'

const REGISTERED = {
  cobalt,
  forest,
  bordeaux,
  'cobalt-colour': cobaltColour,
  'forest-colour': forestColour,
  'bordeaux-colour': bordeauxColour,
}

it('registers each colourway under its own name and in Colour with a suffix', () => {
  expect(APP_THEMES).toEqual(REGISTERED)
})

it('registers the Light themes first, so Jest uses Cobalt', () => {
  expect(Object.keys(APP_THEMES)).toEqual([
    'cobalt',
    'forest',
    'bordeaux',
    'cobalt-colour',
    'forest-colour',
    'bordeaux-colour',
  ])
})

it('gives styles the Cobalt theme in Jest, because it is registered first', () => {
  const styles = StyleSheet.create((theme) => ({ box: { backgroundColor: theme.colors.background } }))
  expect(styles.box.backgroundColor).toBe(cobalt.colors.background)
  expect(UnistylesRuntime.getTheme()).toBe(cobalt)
})

// Keep these tests last: each isolated run registers new theme objects in the global registry of the Unistyles mock.
it.each([
  [null, null, { initialTheme: 'cobalt' }],
  ['forest', 'auto', { initialTheme: 'forest' }],
  ['forest', null, { initialTheme: 'forest' }],
  ['bordeaux', 'light', { initialTheme: 'bordeaux' }],
  ['forest', 'colour', { initialTheme: 'forest-colour' }],
  [null, 'colour', { initialTheme: 'cobalt-colour' }],
  ['midnight', 'colour', { initialTheme: 'cobalt-colour' }],
  ['sepia', 'dark', { initialTheme: 'cobalt' }],
])('configures the saved choice %p and appearance %p before the first frame', (saved, appearance, settings) => {
  // A fresh module registry runs the configure call again. jest.doMock cannot replace the mock of the setup file.
  jest.isolateModules(() => {
    const configure = jest.spyOn(require('react-native-unistyles').StyleSheet, 'configure')
    jest
      .mocked(require('expo-sqlite/kv-store').default.getItemSync)
      .mockReturnValueOnce(saved)
      .mockReturnValueOnce(appearance)
    // oxlint-disable-next-line import/no-unassigned-import -- the module calls configure as its side effect.
    require('./unistyles')
    expect(configure).toHaveBeenCalledWith({ themes: REGISTERED, settings })
  })
})

it('configures Unistyles with the default theme when the store throws', () => {
  jest.isolateModules(() => {
    const configure = jest.spyOn(require('react-native-unistyles').StyleSheet, 'configure')
    jest.spyOn(console, 'log').mockImplementationOnce(() => {})
    jest.mocked(require('expo-sqlite/kv-store').default.getItemSync).mockImplementationOnce(() => {
      throw new Error('disk')
    })
    // oxlint-disable-next-line import/no-unassigned-import -- the module calls configure as its side effect.
    require('./unistyles')
    expect(configure).toHaveBeenCalledWith({ themes: REGISTERED, settings: { initialTheme: 'cobalt' } })
  })
})

it('starts Auto in the Colour theme when the system is dark, before the first frame', () => {
  jest.isolateModules(() => {
    const configure = jest.spyOn(require('react-native-unistyles').StyleSheet, 'configure')
    jest.spyOn(require('react-native').Appearance, 'getColorScheme').mockReturnValueOnce('dark')
    jest
      .mocked(require('expo-sqlite/kv-store').default.getItemSync)
      .mockReturnValueOnce('forest')
      .mockReturnValueOnce('auto')
    // oxlint-disable-next-line import/no-unassigned-import -- the module calls configure as its side effect.
    require('./unistyles')
    expect(configure).toHaveBeenCalledWith({ themes: REGISTERED, settings: { initialTheme: 'forest-colour' } })
  })
})

it('starts Auto in the Light theme when the system is light', () => {
  jest.isolateModules(() => {
    const configure = jest.spyOn(require('react-native-unistyles').StyleSheet, 'configure')
    jest.spyOn(require('react-native').Appearance, 'getColorScheme').mockReturnValueOnce('light')
    jest
      .mocked(require('expo-sqlite/kv-store').default.getItemSync)
      .mockReturnValueOnce('forest')
      .mockReturnValueOnce('auto')
    // oxlint-disable-next-line import/no-unassigned-import -- the module calls configure as its side effect.
    require('./unistyles')
    expect(configure).toHaveBeenCalledWith({ themes: REGISTERED, settings: { initialTheme: 'forest' } })
  })
})
