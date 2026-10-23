import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { AssistRow } from './AssistRow'

const props = { label: 'Box', description: 'Shade the 3×3 box of the selected cell.', value: true }

// The switch speaks for the row, so VoiceOver skips the visible text.
const hidden = { includeHiddenElements: true }

it('shows the label and the description', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByText('Box', hidden)).toBeTruthy()
  expect(screen.getByText(props.description, hidden)).toBeTruthy()
})

it('hides the visible text from VoiceOver', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.queryByText('Box')).toBeNull()
  expect(screen.queryByText(props.description)).toBeNull()
})

it('gives the switch the description as the hint', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByLabelText('Box').props.accessibilityHint).toBe(props.description)
})

it('gives the switch the label and the checked state, so VoiceOver reads both', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByRole('switch', { name: 'Box' }).props.accessibilityState).toMatchObject({ checked: true })
})

it('reports the new value', () => {
  const onChange = jest.fn()
  render(<AssistRow {...props} onChange={onChange} />)
  fireEvent.press(screen.getByLabelText('Box'))
  expect(onChange).toHaveBeenCalledWith(false)
})

it('draws the boxy toggle of the theme, not the native switch', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByTestId('toggle-track')).toBeTruthy()
  expect(screen.getByTestId('toggle-thumb')).toBeTruthy()
})

it('is at least 44 pt high', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('assist-row-Box').props.style).minHeight).toBeGreaterThanOrEqual(44)
})
