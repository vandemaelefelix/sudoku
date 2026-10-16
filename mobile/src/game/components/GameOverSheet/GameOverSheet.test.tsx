import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { cobalt } from '@/theme/themes/cobalt'
import { LOST_HOLD_MS } from './GameOverSheet.constants'
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

const lose = () => {
  fireEvent.press(screen.getByTestId('lose'))
  act(() => jest.advanceTimersByTime(LOST_HOLD_MS))
}

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

it('holds a moment after the last mistake before the sheet rises', () => {
  renderSheet()
  fireEvent.press(screen.getByTestId('lose'))
  expect(screen.queryByTestId('game-over')).toBeNull()
  act(() => jest.advanceTimersByTime(LOST_HOLD_MS))
  expect(screen.getByTestId('game-over')).toBeTruthy()
})

it('sinks the sheet over the short duration before it calls Retry', () => {
  const onRetry = jest.fn()
  renderSheet({ onRetry })
  lose()
  const timing = jest.spyOn(reanimated, 'withTiming')
  fireEvent.press(screen.getByText('Try this puzzle again'))
  expect(timing).toHaveBeenCalledWith(
    1,
    expect.objectContaining({ duration: cobalt.motion.short }),
    expect.any(Function),
  )
  act(() => jest.runAllTicks())
  expect(onRetry).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByText('Try this puzzle again'))
  act(() => jest.runAllTicks())
  expect(onRetry).toHaveBeenCalledTimes(1)
})

it('rises again and takes taps again when a restart fails', async () => {
  const onRetry = jest.fn(async () => undefined)
  renderSheet({ onRetry })
  lose()
  fireEvent.press(screen.getByText('Try this puzzle again'))
  // The sink ends through a microtask, and the failed restart settles in a second one.
  await act(async () => {
    jest.runAllTicks()
    await Promise.resolve()
  })
  expect(onRetry).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByText('Try this puzzle again'))
  await act(async () => {
    jest.runAllTicks()
    await Promise.resolve()
  })
  expect(onRetry).toHaveBeenCalledTimes(2)
})

it('ignores Back to home while the sheet sinks for a retry', () => {
  const onRetry = jest.fn()
  const onHome = jest.fn()
  jest.spyOn(reanimated, 'withTiming').mockImplementation((toValue) => toValue)
  renderSheet({ onRetry, onHome })
  lose()
  fireEvent.press(screen.getByText('Try this puzzle again'))
  fireEvent.press(screen.getByText('Back to home'))
  expect(onHome).not.toHaveBeenCalled()
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
    backgroundColor: cobalt.colors.scrim,
  })
  expect(screen.getByRole('header', { name: 'Out of mistakes' })).toBeTruthy()
})

// The React Native Jest setup makes this a shared mock, so it keeps the calls of earlier tests.
const focusSpy = () => jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear()

// The ref of the title is the Text component, so the test finds it by its props.
const theTitle = expect.objectContaining({
  props: expect.objectContaining({ accessibilityRole: 'header', children: 'Out of mistakes' }),
})

it('moves the VoiceOver focus to the title when the rise ends', () => {
  const focus = focusSpy()
  let endRise: ((finished?: boolean) => void) | undefined
  jest.spyOn(reanimated, 'withTiming').mockImplementation((toValue, _config, callback) => {
    endRise = callback
    return toValue
  })
  renderSheet()
  lose()
  expect(focus).not.toHaveBeenCalled()
  // The end of the rise reaches the JS thread through a microtask, which the fake timers hold.
  act(() => {
    endRise?.(true)
    jest.runAllTicks()
  })
  expect(focus).toHaveBeenCalledTimes(1)
  expect(focus).toHaveBeenCalledWith(theTitle, 'focus')
})

it('moves the VoiceOver focus to the title at once with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const focus = focusSpy()
  renderSheet()
  lose()
  expect(focus).toHaveBeenCalledTimes(1)
  expect(focus).toHaveBeenCalledWith(theTitle, 'focus')
})

it.each([
  ['Try this puzzle again', 'onRetry'],
  ['New puzzle', 'onNewPuzzle'],
  ['Back to home', 'onHome'],
] as const)('calls back from %s', (name, callback) => {
  const callbacks = { onRetry: jest.fn(), onNewPuzzle: jest.fn(), onHome: jest.fn() }
  renderSheet(callbacks)
  lose()
  fireEvent.press(screen.getByRole('button', { name }))
  // Retry and New puzzle call back at the end of the sink, which reaches the JS thread through a microtask.
  act(() => jest.runAllTicks())
  expect(callbacks[callback]).toHaveBeenCalledTimes(1)
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
  expect(timing).toHaveBeenCalledWith(
    0,
    expect.objectContaining({ duration: cobalt.motion.medium }),
    expect.any(Function),
  )
})

it('shows the sheet at once with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const timing = jest.spyOn(reanimated, 'withTiming')
  renderSheet()
  lose()
  expect(timing).not.toHaveBeenCalled()
  expect(StyleSheet.flatten(screen.getByTestId('game-over').props.style)).toMatchObject({ opacity: 1 })
  expect(StyleSheet.flatten(screen.getByTestId('game-over-sheet').props.style)).toMatchObject({
    transform: [{ translateY: 0 }],
  })
})
