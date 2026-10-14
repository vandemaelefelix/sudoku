import { fireEvent, render, screen } from '@testing-library/react-native'
import { HomeMenu } from './HomeMenu'

import type { HomeStats } from '@/home/utils/homeStats.utils'

function renderMenu(continueLevel: 'medium' | null = null, stats: HomeStats | null | undefined = null) {
  const props = {
    continueLevel,
    stats,
    onNewGame: jest.fn(),
    onContinue: jest.fn(),
    onScan: jest.fn(),
    onSettings: jest.fn(),
    onStats: jest.fn(),
  }
  render(<HomeMenu {...props} />)
  return props
}

it('lists the four levels, and a tap asks for a game at that level', () => {
  const { onNewGame } = renderMenu()
  for (const name of ['Easy', 'Medium', 'Hard', 'Expert']) {
    expect(screen.getByRole('button', { name })).toBeTruthy()
  }
  fireEvent.press(screen.getByRole('button', { name: 'Expert' }))
  expect(onNewGame).toHaveBeenCalledWith('expert')
})

it('shows Continue only when a game is in progress', () => {
  renderMenu(null)
  expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull()
})

it('shows Continue and the levels together when a game is in progress', () => {
  const { onContinue } = renderMenu('medium')
  fireEvent.press(screen.getByRole('button', { name: 'Continue, Medium' }))
  expect(onContinue).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Easy' })).toBeTruthy()
})

it('links to Scan and to Settings', () => {
  const { onScan, onSettings } = renderMenu()
  fireEvent.press(screen.getByRole('button', { name: 'Scan a puzzle' }))
  fireEvent.press(screen.getByRole('button', { name: 'Settings' }))
  expect(onScan).toHaveBeenCalledTimes(1)
  expect(onSettings).toHaveBeenCalledTimes(1)
})

it('shows the stats card, and a tap opens the stats', () => {
  const { onStats } = renderMenu(null, { winRate: 0.76, played: 25, streak: 3 })
  fireEvent.press(screen.getByRole('button', { name: '76% won, 3 day streak. Open stats' }))
  expect(onStats).toHaveBeenCalledTimes(1)
})

it('shows a line of text instead of the card when no game finished', () => {
  renderMenu(null, { winRate: null, played: 0, streak: 0 })
  expect(screen.getByText('No finished games yet. Your stats show up here.')).toBeTruthy()
  expect(screen.queryByLabelText(/day streak/)).toBeNull()
})

it('shows neither the card nor the line when the stats did not load', () => {
  renderMenu(null, null)
  expect(screen.queryByLabelText(/day streak/)).toBeNull()
  expect(screen.queryByText(/No finished games/)).toBeNull()
})
