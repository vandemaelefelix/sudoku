import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { AppearancePicker } from './AppearancePicker'

it('offers Auto, Light and Colour, in that order, and marks the current choice', () => {
  render(<AppearancePicker value="light" onChange={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Light', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Colour', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Auto', selected: false })).toBeTruthy()
  expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
    'Auto',
    'Light',
    'Colour',
  ])
})

it('reports the new appearance by its value', () => {
  const onChange = jest.fn()
  render(<AppearancePicker value="light" onChange={onChange} />)
  fireEvent.press(screen.getByRole('button', { name: 'Colour' }))
  expect(onChange).toHaveBeenCalledWith('colour')
  fireEvent.press(screen.getByRole('button', { name: 'Auto' }))
  expect(onChange).toHaveBeenCalledWith('auto')
})

it('gives each choice a 44 pt touch target: the row is 44 pt high and each choice fills it', () => {
  render(<AppearancePicker value="light" onChange={jest.fn()} />)
  expect(
    StyleSheet.flatten(screen.getByTestId('appearance-indicator-cells').props.style).minHeight,
  ).toBeGreaterThanOrEqual(44)
  for (const name of ['Auto', 'Light', 'Colour']) {
    expect(StyleSheet.flatten(screen.getByRole('button', { name }).props.style).flex).toBe(1)
  }
})

it('slides its own indicator to the chosen cell', () => {
  render(<AppearancePicker value="colour" onChange={jest.fn()} />)
  fireEvent(screen.getByTestId('appearance-indicator-cells'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } },
  })
  screen.rerender(<AppearancePicker value="colour" onChange={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('appearance-indicator').props.style)).toMatchObject({
    opacity: 1,
    width: 100,
    transform: [{ translateX: 200 }],
  })
})
