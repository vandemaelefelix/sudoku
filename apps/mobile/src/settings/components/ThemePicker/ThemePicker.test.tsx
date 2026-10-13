import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { ThemePicker } from './ThemePicker'

it('offers System and every theme, and marks the current choice', () => {
  render(<ThemePicker value="daylight" onChange={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'System', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Daylight', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Midnight', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Op-art', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Progressive', selected: false })).toBeTruthy()
})

it('reports a new theme by its name', () => {
  const onChange = jest.fn()
  render(<ThemePicker value="system" onChange={onChange} />)
  fireEvent.press(screen.getByRole('button', { name: 'Op-art' }))
  expect(onChange).toHaveBeenCalledWith('opart')
})

it('reports a tap', () => {
  const onChange = jest.fn()
  render(<ThemePicker value="system" onChange={onChange} />)
  fireEvent.press(screen.getByRole('button', { name: 'Midnight' }))
  expect(onChange).toHaveBeenCalledWith('midnight')
})

it('gives each choice a 44 pt touch target', () => {
  render(<ThemePicker value="system" onChange={jest.fn()} />)
  for (const name of ['System', 'Daylight', 'Midnight', 'Op-art', 'Progressive']) {
    const segment = screen.getByRole('button', { name })
    expect(StyleSheet.flatten(segment.props.style).minHeight).toBeGreaterThanOrEqual(44)
  }
})
