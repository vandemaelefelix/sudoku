import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { AuthButton } from './AuthButton'

it('is a button of at least the touch size that calls onPress', () => {
  const onPress = jest.fn()
  render(<AuthButton label="Sign in" kind="primary" onPress={onPress} />)
  const button = screen.getByRole('button', { name: 'Sign in' })
  fireEvent.press(button)
  expect(onPress).toHaveBeenCalled()
  expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(cobalt.size.touch)
  expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(cobalt.components.button.primary)
})

it('does not act while busy, and says so to VoiceOver', () => {
  const onPress = jest.fn()
  render(<AuthButton label="Sign in" kind="primary" busy onPress={onPress} />)
  const button = screen.getByRole('button', { name: 'Sign in' })
  fireEvent.press(button)
  expect(onPress).not.toHaveBeenCalled()
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
})

it('draws the outline kind with the outline tokens', () => {
  render(<AuthButton label="Create an account" kind="outline" onPress={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByRole('button').props.style)).toMatchObject({
    backgroundColor: cobalt.components.button.second,
    borderColor: cobalt.components.button.outline,
  })
})
