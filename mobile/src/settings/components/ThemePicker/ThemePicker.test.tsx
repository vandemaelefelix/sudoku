import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { ThemePicker } from './ThemePicker'

it('offers the three colourways and marks the current choice', () => {
  render(<ThemePicker value="cobalt" onChange={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Cobalt', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Forest', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Bordeaux', selected: false })).toBeTruthy()
  expect(screen.getAllByRole('button')).toHaveLength(3)
})

it('reports a new theme by its name', () => {
  const onChange = jest.fn()
  render(<ThemePicker value="cobalt" onChange={onChange} />)
  fireEvent.press(screen.getByRole('button', { name: 'Bordeaux' }))
  expect(onChange).toHaveBeenCalledWith('bordeaux')
})

it('gives each choice a 44 pt touch target: the row is 44 pt high and each choice fills it', () => {
  render(<ThemePicker value="cobalt" onChange={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('theme-indicator-cells').props.style).minHeight).toBeGreaterThanOrEqual(
    44,
  )
  for (const name of ['Cobalt', 'Forest', 'Bordeaux']) {
    expect(StyleSheet.flatten(screen.getByRole('button', { name }).props.style).flex).toBe(1)
  }
})

it('places the indicator on the chosen cell once the control has a width', () => {
  render(<ThemePicker value="forest" onChange={jest.fn()} />)
  fireEvent(screen.getByTestId('theme-indicator-cells'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } },
  })
  // The Reanimated mock reads the shared value in render, and the control sets it in an effect after the layout.
  screen.rerender(<ThemePicker value="forest" onChange={jest.fn()} />)
  const indicator = StyleSheet.flatten(screen.getByTestId('theme-indicator').props.style)
  expect(indicator).toMatchObject({ opacity: 1, width: 100, transform: [{ translateX: 100 }] })
})
