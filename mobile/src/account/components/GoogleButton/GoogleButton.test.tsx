import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { GoogleButton } from './GoogleButton'

it('is an outline button with the Google logo', () => {
  const onPress = jest.fn()
  render(<GoogleButton busy={false} onPress={onPress} />)
  const button = screen.getByRole('button', { name: 'Continue with Google' })
  expect(StyleSheet.flatten(button.props.style).borderColor).toBe(cobalt.components.button.outline)
  expect(screen.getByTestId('google-logo', { includeHiddenElements: true })).toBeTruthy()
  fireEvent.press(button)
  expect(onPress).toHaveBeenCalled()
})
