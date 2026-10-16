import { render, screen } from '@testing-library/react-native'
import { DayStrip } from './DayStrip'

const days = [...Array.from({ length: 10 }, () => false), true, true, true, false]

it('reads the strip as one sentence', () => {
  render(<DayStrip days={days} />)
  expect(screen.getByLabelText('Last 14 days: wins on 3 days. Today has no win yet.')).toBeTruthy()
})

it('says nothing about today when today has a win', () => {
  render(<DayStrip days={[...days.slice(0, 13), true]} />)
  expect(screen.getByLabelText('Last 14 days: wins on 4 days.')).toBeTruthy()
})

it('draws one square for each day', () => {
  render(<DayStrip days={days} />)
  expect(screen.getAllByTestId('day-square')).toHaveLength(14)
})

it('reads one win in the singular', () => {
  render(<DayStrip days={[...Array.from({ length: 12 }, () => false), true, true]} />)
  expect(screen.getByLabelText('Last 14 days: wins on 2 days.')).toBeTruthy()
  render(<DayStrip days={[...Array.from({ length: 13 }, () => false), true]} />)
  expect(screen.getByLabelText('Last 14 days: wins on 1 day.')).toBeTruthy()
})
