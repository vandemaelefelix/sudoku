import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { CardRow } from './CardRow'

const hidden = { includeHiddenElements: true }

it('shows the label and the description', () => {
  render(<CardRow label="Haptics" description="A tick on each tap." />)
  expect(screen.getByText('Haptics')).toBeTruthy()
  expect(screen.getByText('A tick on each tap.')).toBeTruthy()
})

it('shows no description when it gets none', () => {
  render(<CardRow label="Sign out" onPress={jest.fn()} />)
  expect(screen.getByText('Sign out')).toBeTruthy()
})

it('is a button that reports a press when it has onPress', () => {
  const onPress = jest.fn()
  render(<CardRow label="Techniques" accessibilityLabel="Techniques" accessibilityHint="Learn." onPress={onPress} />)
  const button = screen.getByRole('button', { name: 'Techniques' })
  expect(button.props.accessibilityHint).toBe('Learn.')
  fireEvent.press(button)
  expect(onPress).toHaveBeenCalledTimes(1)
})

it('is no button without onPress', () => {
  render(<CardRow label="Haptics" />)
  expect(screen.queryByRole('button')).toBeNull()
})

it('does not press while it is disabled, and says so', () => {
  const onPress = jest.fn()
  render(<CardRow label="Delete" disabled onPress={onPress} />)
  const button = screen.getByRole('button')
  expect(button.props.accessibilityState).toMatchObject({ disabled: true })
  fireEvent.press(button)
  expect(onPress).not.toHaveBeenCalled()
})

it('shows the control at the end, and hides the visible text from VoiceOver', () => {
  render(<CardRow label="Haptics" description="A tick." trailing={<Text>Control</Text>} />)
  expect(screen.getByText('Control')).toBeTruthy()
  expect(screen.queryByText('Haptics')).toBeNull()
  expect(screen.getByText('Haptics', hidden)).toBeTruthy()
})

it('keeps the visible text for VoiceOver when the row is a button with an arrow', () => {
  render(<CardRow label="Techniques" chevron onPress={jest.fn()} />)
  expect(screen.getByText('Techniques')).toBeTruthy()
})

it('is the VoiceOver element with its label when a row that only shows a value has one', () => {
  render(<CardRow label="me@example.com" tone="quiet" accessibilityLabel="Signed in as me@example.com" />)
  expect(screen.getByLabelText('Signed in as me@example.com').props.accessible).toBe(true)
})

it('colours a danger label with the danger token', () => {
  render(<CardRow label="Delete" tone="danger" onPress={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByText('Delete').props.style).color).toBe(cobalt.colors.danger)
})

it('is at least 44 pt high', () => {
  render(<CardRow label="Haptics" testID="row" />)
  expect(StyleSheet.flatten(screen.getByTestId('row').props.style).minHeight).toBeGreaterThanOrEqual(44)
})
