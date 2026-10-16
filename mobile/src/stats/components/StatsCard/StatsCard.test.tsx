import { fireEvent, render, screen } from '@testing-library/react-native'
import { StatsCard } from './StatsCard'

it('shows the win rate and the streak', () => {
  render(<StatsCard winRate={0.76} streak={3} />)
  expect(screen.getByText('76%')).toBeTruthy()
  expect(screen.getByLabelText('76% won, 3 day streak')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('is a button that opens the stats when it has an action', () => {
  const onPress = jest.fn()
  render(<StatsCard winRate={0.5} streak={0} onPress={onPress} />)
  fireEvent.press(screen.getByRole('button', { name: '50% won, 0 day streak. Open stats' }))
  expect(onPress).toHaveBeenCalledTimes(1)
})

it('writes a dash for a win rate that does not exist, and says so in words', () => {
  render(<StatsCard winRate={null} streak={0} />)
  expect(screen.getByText('–')).toBeTruthy()
  expect(screen.getByLabelText('No games finished, 0 day streak')).toBeTruthy()
  expect(screen.queryByText(/NaN/)).toBeNull()
})
