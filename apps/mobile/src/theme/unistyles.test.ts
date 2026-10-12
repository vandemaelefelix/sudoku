import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'
import { APP_THEMES } from './unistyles'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'

it('registers Daylight as light and Midnight as dark, the names adaptive themes need', () => {
  expect(APP_THEMES).toEqual({ light: daylight, dark: midnight })
})

it('gives styles the Daylight theme in Jest, because it is registered first', () => {
  const styles = StyleSheet.create((theme) => ({ box: { backgroundColor: theme.colors.background } }))
  expect(styles.box.backgroundColor).toBe(daylight.colors.background)
  expect(UnistylesRuntime.getTheme()).toBe(daylight)
})

// Keep these tests last: each isolated run registers new theme objects in the global registry of the Unistyles mock.
it.each([
  [null, { adaptiveThemes: true }],
  ['midnight', { initialTheme: 'dark' }],
  ['sepia', { adaptiveThemes: true }],
])('configures the saved choice %p before the first frame', (saved, settings) => {
  // A fresh module registry runs the configure call again. jest.doMock cannot replace the mock of the setup file.
  jest.isolateModules(() => {
    const configure = jest.spyOn(require('react-native-unistyles').StyleSheet, 'configure')
    jest.mocked(require('expo-sqlite/kv-store').default.getItemSync).mockReturnValueOnce(saved)
    // oxlint-disable-next-line import/no-unassigned-import -- the module calls configure as its side effect.
    require('./unistyles')
    expect(configure).toHaveBeenCalledWith({ themes: { light: daylight, dark: midnight }, settings })
  })
})
