import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { ThemePicker } from './ThemePicker'

it('offers System, Daylight and Midnight, and marks the current choice', () => {
  render(<ThemePicker value="daylight" onChange={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'System', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Daylight', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Midnight', selected: false })).toBeTruthy()
})

it('reports a tap', () => {
  const onChange = jest.fn()
  render(<ThemePicker value="system" onChange={onChange} />)
  fireEvent.press(screen.getByRole('button', { name: 'Midnight' }))
  expect(onChange).toHaveBeenCalledWith('midnight')
})

it('gives each choice a 44 pt touch target', () => {
  render(<ThemePicker value="system" onChange={jest.fn()} />)
  for (const name of ['System', 'Daylight', 'Midnight']) {
    const segment = screen.getByRole('button', { name })
    expect(StyleSheet.flatten(segment.props.style).minHeight).toBeGreaterThanOrEqual(44)
  }
})
