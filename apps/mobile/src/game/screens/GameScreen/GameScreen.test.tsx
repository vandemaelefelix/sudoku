import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameScreen } from './GameScreen'

const renderScreen = (onBack = jest.fn()) => {
  render(<GameScreen start={sampleStart()} onBack={onBack} />)
  // The board draws the grid after it knows its size.
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })
}

it('shows the header, the grid, the tools and the keypad', () => {
  renderScreen()
  expect(screen.getByLabelText('Back to home')).toBeTruthy()
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
  expect(screen.getByLabelText('Hint')).toBeTruthy()
  expect(screen.getByLabelText('Enter 9')).toBeTruthy()
})

it('gives a light haptic tap for a placed number', () => {
  jest.mocked(Haptics.impactAsync).mockClear()
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('fills a mistake dot for a wrong number', () => {
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Enter 5'))
  expect(screen.getByLabelText('1 of 3 mistakes')).toBeTruthy()
  expect(screen.getByLabelText('Row 1, column 3, wrong 5')).toBeTruthy()
})

it('locks the tools and the keypad when the game is lost', () => {
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6, 7]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  expect(screen.getByLabelText('Enter 4')).toBeDisabled()
  expect(screen.getByLabelText('Hint')).toBeDisabled()
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(screen.getByLabelText('Row 1, column 3, wrong 7')).toBeTruthy()
})

it('stops the timer when the game is lost', () => {
  jest.useFakeTimers()
  renderScreen()
  act(() => jest.advanceTimersByTime(2000))
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6, 7]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  act(() => jest.advanceTimersByTime(5000))
  expect(screen.getByText('00:02')).toBeTruthy()
  jest.useRealTimers()
})

it('calls onBack from the back button', () => {
  const onBack = jest.fn()
  renderScreen(onBack)
  fireEvent.press(screen.getByLabelText('Back to home'))
  expect(onBack).toHaveBeenCalled()
})
