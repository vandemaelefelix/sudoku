import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { daylight } from '@/theme/themes/daylight'
import { GameOverSheet } from './GameOverSheet'

const reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated')

// A right 4 in cell 2, then three wrong numbers in cell 3, whose solution is 6: 31 right cells.
function LoseButton() {
  const { select, digit } = useGameActions()
  const lose = () => {
    select(2)
    digit(4)
    select(3)
    for (const wrong of [5, 7, 8] as const) digit(wrong)
  }
  return <Pressable testID="lose" onPress={lose} />
}

type Callbacks = { onRetry?: () => void; onNewPuzzle?: () => void; onHome?: () => void }

function renderSheet({ onRetry = jest.fn(), onNewPuzzle, onHome = jest.fn() }: Callbacks = {}) {
  render(
    <GameProvider start={sampleStart()}>
      <LoseButton />
      <GameOverSheet onRetry={onRetry} onNewPuzzle={onNewPuzzle} onHome={onHome} />
    </GameProvider>,
  )
}

const lose = () => fireEvent.press(screen.getByTestId('lose'))

beforeEach(() => jest.useFakeTimers())

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('renders nothing while the game is playing', () => {
  renderSheet()
  expect(screen.queryByTestId('game-over')).toBeNull()
})

it('says the game is over, with the right cells and the time played', () => {
  renderSheet()
  act(() => jest.advanceTimersByTime(2000))
  lose()
  expect(screen.getByText('Out of mistakes')).toBeTruthy()
  expect(screen.getByText('Three wrong numbers end this game. You had 31 of 81 cells right after 00:02.')).toBeTruthy()
})

it('covers the screen with the scrim and is modal for VoiceOver', () => {
  renderSheet()
  lose()
  const scrim = screen.getByTestId('game-over')
  expect(scrim.props.accessibilityViewIsModal).toBe(true)
  expect(StyleSheet.flatten(scrim.props.style)).toMatchObject({
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: daylight.colors.scrim,
  })
  expect(screen.getByRole('header', { name: 'Out of mistakes' })).toBeTruthy()
})

it('moves the VoiceOver focus to the title', () => {
  // The React Native Jest setup makes this a shared mock, so it keeps the calls of earlier tests.
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear()
  renderSheet()
  lose()
  expect(focus).toHaveBeenCalledTimes(1)
  expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus')
})

it('calls back from each button', () => {
  const onRetry = jest.fn()
  const onNewPuzzle = jest.fn()
  const onHome = jest.fn()
  renderSheet({ onRetry, onNewPuzzle, onHome })
  lose()
  fireEvent.press(screen.getByRole('button', { name: 'Try this puzzle again' }))
  fireEvent.press(screen.getByRole('button', { name: 'New puzzle' }))
  fireEvent.press(screen.getByRole('button', { name: 'Back to home' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(onNewPuzzle).toHaveBeenCalledTimes(1)
  expect(onHome).toHaveBeenCalledTimes(1)
})

it('gives every button a touch target of 44 pt or more', () => {
  renderSheet({ onNewPuzzle: jest.fn() })
  lose()
  for (const name of ['Try this puzzle again', 'New puzzle', 'Back to home']) {
    const { minHeight } = StyleSheet.flatten(screen.getByRole('button', { name }).props.style)
    expect(minHeight).toBeGreaterThanOrEqual(44)
  }
})

it('has no New puzzle button without a callback', () => {
  renderSheet()
  lose()
  expect(screen.queryByRole('button', { name: 'New puzzle' })).toBeNull()
})

it('rises over the medium duration', () => {
  const timing = jest.spyOn(reanimated, 'withTiming')
  renderSheet()
  lose()
  expect(timing).toHaveBeenCalledWith(0, expect.objectContaining({ duration: daylight.motion.medium }))
})

it('shows the sheet at once with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const timing = jest.spyOn(reanimated, 'withTiming')
  renderSheet()
  lose()
  expect(timing).not.toHaveBeenCalled()
  expect(StyleSheet.flatten(screen.getByTestId('game-over-sheet').props.style)).toMatchObject({
    opacity: 1,
    transform: [{ translateY: 0 }],
  })
})
