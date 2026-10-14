import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { TimesChart } from './TimesChart'

it('draws nothing without a win', () => {
  render(<TimesChart times={[]} />)
  expect(screen.toJSON()).toBeNull()
})

it('draws a bar for each win, and names the fastest time', () => {
  render(<TimesChart times={[90_000, 60_000, 272_000]} />)
  expect(screen.getAllByTestId('time-bar')).toHaveLength(3)
  expect(screen.getByText('01:00')).toBeTruthy()
  expect(screen.getByLabelText('Times of the last 3 wins, newest on the right. The fastest is 1 minute.')).toBeTruthy()
})

it('makes the slowest bar the tallest, and no bar shorter than the minimum', () => {
  render(<TimesChart times={[1_000, 1_000_000]} />)
  const [fast = 0, slow = 0] = screen
    .getAllByTestId('time-bar')
    .map((bar) => StyleSheet.flatten(bar.props.style).height)
  expect(slow).toBeGreaterThan(fast)
  expect(fast).toBeGreaterThanOrEqual(8)
})

it('gives every bar a real height when all the times are 0', () => {
  render(<TimesChart times={[0, 0]} />)
  for (const bar of screen.getAllByTestId('time-bar')) {
    expect(Number.isFinite(StyleSheet.flatten(bar.props.style).height)).toBe(true)
  }
})

it('reads one win in the singular', () => {
  render(<TimesChart times={[60_000]} />)
  expect(screen.getByLabelText('Times of the last 1 win, newest on the right. The fastest is 1 minute.')).toBeTruthy()
})

it('keeps room for 10 bars, so one win is one narrow bar on the right', () => {
  render(<TimesChart times={[60_000]} />)
  expect(screen.getAllByTestId('time-bar')).toHaveLength(1)
  expect(screen.getAllByTestId('time-slot-empty')).toHaveLength(9)
})

it('has no empty slot when 10 wins fill the chart', () => {
  render(<TimesChart times={Array.from({ length: 10 }, (_, index) => 60_000 + index)} />)
  expect(screen.queryByTestId('time-slot-empty')).toBeNull()
})

it('keeps the fastest time on one line, whatever the width of its slot', () => {
  render(<TimesChart times={[60_000]} />)
  expect(screen.getByText('01:00').props.numberOfLines).toBe(1)
})
