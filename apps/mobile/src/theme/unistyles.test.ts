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
