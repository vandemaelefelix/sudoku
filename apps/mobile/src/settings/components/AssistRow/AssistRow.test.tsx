import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Switch } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { AssistRow } from './AssistRow'

const props = { label: 'Box', description: 'Shade the 3×3 box of the selected cell.', value: true, divider: false }

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

it('gives the switch the label and the value, so VoiceOver reads both', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByLabelText('Box').props.value).toBe(true)
})

it('reports the new value', () => {
  const onChange = jest.fn()
  render(<AssistRow {...props} onChange={onChange} />)
  fireEvent(screen.getByLabelText('Box'), 'valueChange', false)
  expect(onChange).toHaveBeenCalledWith(false)
})

it('colours the track from the theme and keeps the native thumb', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  const native = screen.UNSAFE_getByType(Switch)
  expect(native.props).toMatchObject({
    trackColor: { false: daylight.components.switch.off, true: daylight.components.switch.on },
    ios_backgroundColor: daylight.components.switch.off,
  })
  expect(native.props.thumbColor).toBeUndefined()
})

it('is at least 44 pt high', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('assist-row-Box').props.style).minHeight).toBeGreaterThanOrEqual(44)
})
