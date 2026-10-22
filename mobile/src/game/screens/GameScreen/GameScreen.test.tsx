import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { LOST_HOLD_MS } from '@/game/components/GameOverSheet/GameOverSheet.constants'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameScreen } from './GameScreen'

type Callbacks = { onBack?: () => void; onNewPuzzle?: () => void; onRetry?: () => void }

const layoutBoard = () =>
  // The board draws the grid after it knows its size.
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })

const renderScreen = ({ onBack = jest.fn(), onNewPuzzle, onRetry = jest.fn() }: Callbacks = {}) => {
  render(<GameScreen start={sampleStart()} onBack={onBack} onNewPuzzle={onNewPuzzle} onRetry={onRetry} />)
  layoutBoard()
}

// Cell 2 is empty in the canvas puzzle. Its solution is 4.
const loseOnCell2 = () => {
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6, 7]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  act(() => jest.advanceTimersByTime(LOST_HOLD_MS))
}

// The sheet sinks before it calls back. The end of that animation reaches the JS thread through a microtask.
const pressOnSheet = (name: string) => {
  fireEvent.press(screen.getByRole('button', { name }))
  act(() => jest.runAllTicks())
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

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
  act(() => jest.advanceTimersByTime(LOST_HOLD_MS))
  expect(screen.getByText('Out of mistakes')).toBeTruthy()
  expect(screen.getByLabelText('3 of 3 mistakes', hidden)).toBeTruthy()
})

it('leaves the retry to the caller', () => {
  const onRetry = jest.fn()
  renderScreen({ onRetry })
  loseOnCell2()
  pressOnSheet('Try this puzzle again')
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
  pressOnSheet('New puzzle')
  expect(onNewPuzzle).toHaveBeenCalledTimes(1)
})

/**
 * What decides the place of the grid: the board box, the square of the grid, and the tool row and the keypad, which give
 * the dock its height. The hint card is absolute, so it moves nothing.
 */
const gridLayout = () => ({
  board: StyleSheet.flatten(screen.getByTestId('board', hidden).props.style),
  square: StyleSheet.flatten(screen.getByTestId('board-square', hidden).props.style),
  tools: StyleSheet.flatten(screen.getByTestId('tools', hidden).props.style),
  keypad: StyleSheet.flatten(screen.getByTestId('keypad', hidden).props.style),
})

describe('the hint (ADR-032)', () => {
  it('opens the card over the tool row and the keypad, and closes it with the close button', () => {
    renderScreen()
    fireEvent.press(screen.getByLabelText('Hint'))
    expect(screen.getByTestId('hint-card')).toBeTruthy()
    expect(screen.queryByLabelText('Enter 9')).toBeNull()
    expect(screen.queryByLabelText('Undo')).toBeNull()
    expect(screen.getByTestId('dock-controls', hidden).props.pointerEvents).toBe('none')
    expect(screen.getAllByTestId(/^cell-\d+-hint-focus$/).length).toBeGreaterThan(0)
    fireEvent.press(screen.getByLabelText('Close the hint'))
    expect(screen.queryByTestId('hint-card')).toBeNull()
    expect(screen.getByLabelText('Enter 9')).toBeTruthy()
    expect(screen.getByLabelText('Undo')).toBeTruthy()
    expect(screen.queryAllByTestId(/^cell-\d+-hint-focus$/)).toHaveLength(0)
  })

  it('gives VoiceOver focus back to the Hint tool when the card closes', () => {
    renderScreen()
    fireEvent.press(screen.getByLabelText('Hint'))
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear()
    fireEvent.press(screen.getByLabelText('Close the hint'))
    const focused = focus.mock.calls
      .filter(([, event]) => event === 'focus')
      .map(([target]) => (target as unknown as { props: { accessibilityLabel?: string } }).props.accessibilityLabel)
    expect(focused).toEqual(['Hint'])
    focus.mockRestore()
  })

  it('keeps the grid in place when a hint opens, changes rung and closes', () => {
    renderScreen()
    const before = gridLayout()
    fireEvent.press(screen.getByLabelText('Hint'))
    expect(StyleSheet.flatten(screen.getByTestId('hint-card').props.style).position).toBe('absolute')
    expect(gridLayout()).toEqual(before)
    fireEvent.press(screen.getByRole('button', { name: 'More help' }))
    expect(gridLayout()).toEqual(before)
    fireEvent.press(screen.getByLabelText('Close the hint'))
    expect(gridLayout()).toEqual(before)
  })

  it('fills the answer from the card and brings back the keypad', () => {
    renderScreen()
    fireEvent.press(screen.getByLabelText('Hint'))
    fireEvent.press(screen.getByRole('button', { name: 'Show answer' }))
    fireEvent.press(screen.getByRole('button', { name: 'Fill it' }))
    expect(screen.queryByTestId('hint-card')).toBeNull()
    expect(screen.getByLabelText('Enter 9')).toBeTruthy()
    expect(screen.getAllByTestId('cell-flash-hint')).toHaveLength(1)
  })
})
