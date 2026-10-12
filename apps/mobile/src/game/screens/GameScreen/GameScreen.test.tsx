import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameScreen } from './GameScreen'

type Callbacks = { onBack?: () => void; onNewPuzzle?: () => void; onRetry?: () => void }

const layoutBoard = () =>
  // The board draws the grid after it knows its size.
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })

const renderScreen = ({ onBack = jest.fn(), onNewPuzzle, onRetry }: Callbacks = {}) => {
  render(<GameScreen start={sampleStart()} onBack={onBack} onNewPuzzle={onNewPuzzle} onRetry={onRetry} />)
  layoutBoard()
}

// Cell 2 is empty in the canvas puzzle. Its solution is 4.
const loseOnCell2 = () => {
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6, 7]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
}

// The scrim is modal for VoiceOver, so the queries skip the screen under it unless they ask for hidden elements.
const hidden = { includeHiddenElements: true }

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
  loseOnCell2()
  expect(screen.getByLabelText('Enter 4', hidden)).toBeDisabled()
  expect(screen.getByLabelText('Hint', hidden)).toBeDisabled()
  fireEvent.press(screen.getByLabelText('Enter 4', hidden))
  expect(screen.getByLabelText('Row 1, column 3, wrong 7', hidden)).toBeTruthy()
})

it('hides the screen under the game over sheet from VoiceOver', () => {
  renderScreen()
  loseOnCell2()
  expect(screen.queryByLabelText('Hint')).toBeNull()
  expect(screen.getByRole('header', { name: 'Out of mistakes' })).toBeTruthy()
})

afterEach(() => jest.useRealTimers())

it('stops the timer when the game is lost', () => {
  jest.useFakeTimers()
  renderScreen()
  act(() => jest.advanceTimersByTime(2000))
  loseOnCell2()
  act(() => jest.advanceTimersByTime(5000))
  expect(screen.getByText('00:02', hidden)).toBeTruthy()
})

it('calls onBack from the back button', () => {
  const onBack = jest.fn()
  renderScreen({ onBack })
  fireEvent.press(screen.getByLabelText('Back to home'))
  expect(onBack).toHaveBeenCalled()
})

it('shows the game over sheet at the third mistake, and not before', () => {
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  expect(screen.queryByText('Out of mistakes')).toBeNull()
  fireEvent.press(screen.getByLabelText('Enter 7'))
  expect(screen.getByText('Out of mistakes')).toBeTruthy()
  expect(screen.getByLabelText('3 of 3 mistakes', hidden)).toBeTruthy()
})

it('starts the same puzzle again from Try this puzzle again', () => {
  jest.useFakeTimers()
  renderScreen()
  act(() => jest.advanceTimersByTime(2000))
  loseOnCell2()
  fireEvent.press(screen.getByRole('button', { name: 'Try this puzzle again' }))
  expect(screen.queryByText('Out of mistakes')).toBeNull()
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
  expect(screen.getByText('00:00')).toBeTruthy()
  layoutBoard()
  expect(screen.getByLabelText('Row 1, column 3, empty')).toBeTruthy()
  expect(screen.getByLabelText('Row 1, column 1, given 5')).toBeTruthy()
  expect(screen.getByLabelText('Hint')).toBeEnabled()
  expect(screen.getByLabelText('Undo')).toBeDisabled()
  act(() => jest.advanceTimersByTime(3000))
  expect(screen.getByText('00:03')).toBeTruthy()
})

it('leaves the retry to the caller when it gives onRetry', () => {
  const onRetry = jest.fn()
  renderScreen({ onRetry })
  loseOnCell2()
  fireEvent.press(screen.getByRole('button', { name: 'Try this puzzle again' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Out of mistakes')).toBeTruthy()
})

it('goes home from Back to home on the sheet', () => {
  const onBack = jest.fn()
  renderScreen({ onBack })
  loseOnCell2()
  fireEvent.press(screen.getByRole('button', { name: 'Back to home' }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it('asks for a new puzzle from New puzzle on the sheet', () => {
  const onNewPuzzle = jest.fn()
  renderScreen({ onNewPuzzle })
  loseOnCell2()
  fireEvent.press(screen.getByRole('button', { name: 'New puzzle' }))
  expect(onNewPuzzle).toHaveBeenCalledTimes(1)
})
