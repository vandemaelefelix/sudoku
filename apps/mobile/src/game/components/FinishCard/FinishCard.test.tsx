import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { Pressable } from 'react-native'
import { SensorType, useReducedMotion } from 'react-native-reanimated'
import type { Digit, NewGame } from '@sudoku/core'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import type { FinishInfo } from '@/game/utils/finish.utils'
import { pulseLook, solvePulseDuration } from '@/game/utils/pulse.utils'
import { sampleStart } from '@/game/utils/sample.utils'
import { daylight } from '@/theme/themes/daylight'
import { FinishCard } from './FinishCard'

const reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated')
const SOLVE_MS = solvePulseDuration(pulseLook(daylight))
const NOW = () => new Date(Date.UTC(2026, 9, 12, 9, 0, 0))
const GENERATED: FinishInfo = { level: 'medium', source: 'generated', seed: 412_077, bestBeforeMs: 810_000 }

// Every open cell is filled except one. Its solution wins the game.
function nearlyWon(): { start: NewGame; cell: number; digit: Digit } {
  const { givens, solution } = sampleStart()
  const cell = givens.findIndex((digit) => digit === 0)
  const entries = solution.map((digit, index) => (givens[index] === 0 && index !== cell ? digit : 0))
  return { start: { givens, solution, entries }, cell, digit: solution[cell] as Digit }
}

const game = nearlyWon()

function WinButton() {
  const { select, digit } = useGameActions()
  return (
    <Pressable
      testID="win"
      onPress={() => {
        select(game.cell)
        digit(game.digit)
      }}
    />
  )
}

type Options = { info?: FinishInfo; onNewPuzzle?: () => void; onHome?: () => void }

function renderCard({ info = GENERATED, onNewPuzzle, onHome = jest.fn() }: Options = {}) {
  render(
    <GameProvider start={game.start}>
      <WinButton />
      <FinishCard info={info} onNewPuzzle={onNewPuzzle} onHome={onHome} now={NOW} />
    </GameProvider>,
  )
}

const win = () => fireEvent.press(screen.getByTestId('win'))
const endPulse = () => act(() => jest.advanceTimersByTime(SOLVE_MS))

beforeEach(() => jest.useFakeTimers())

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('renders nothing while the game is playing', () => {
  renderCard()
  expect(screen.queryByTestId('finish')).toBeNull()
})

it('shows after the solve pulse, not before', () => {
  renderCard()
  win()
  expect(screen.queryByTestId('finish')).toBeNull()
  endPulse()
  expect(screen.getByTestId('finish')).toBeTruthy()
})

it('shows the level, the time, the stats, the source and the date', () => {
  renderCard()
  win()
  endPulse()
  for (const text of [
    'Solved · Medium',
    'New best',
    'Mistakes',
    '0/3',
    'Hints',
    'Best',
    'Puzzle 412 077',
    '12 Oct 2026',
  ]) {
    expect(screen.getByText(text)).toBeTruthy()
  }
  expect(screen.getAllByTestId(/^card-cell-\d+$/, { includeHiddenElements: true })).toHaveLength(81)
})

it('says scanned from paper and shows no new best for a scanned game', () => {
  renderCard({ info: { level: 'easy', source: 'scanned', seed: null, bestBeforeMs: null } })
  win()
  endPulse()
  expect(screen.getByText('Scanned from paper')).toBeTruthy()
  expect(screen.queryByText('New best')).toBeNull()
})

it('gives the card one VoiceOver label with the whole result', () => {
  renderCard()
  win()
  endPulse()
  expect(screen.getByTestId('finish-card').props.accessibilityLabel).toContain('Solved · Medium. New best. Time')
})

it.each([
  ['New puzzle', 'onNewPuzzle'],
  ['Back to home', 'onHome'],
] as const)('calls back from %s', (name, callback) => {
  const callbacks = { onNewPuzzle: jest.fn(), onHome: jest.fn() }
  renderCard(callbacks)
  win()
  endPulse()
  fireEvent.press(screen.getByRole('button', { name }))
  // New puzzle calls back at the end of the sink, which reaches the JS thread through a microtask.
  act(() => jest.runAllTicks())
  expect(callbacks[callback]).toHaveBeenCalledTimes(1)
})

it('lands a new best with a thud', () => {
  renderCard()
  jest.mocked(Haptics.impactAsync).mockClear()
  win()
  endPulse()
  act(() => jest.runAllTicks())
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
})

it('has no New puzzle button without onNewPuzzle', () => {
  renderCard()
  win()
  endPulse()
  expect(screen.queryByRole('button', { name: 'New puzzle' })).toBeNull()
})

it('tilts with the rotation sensor', () => {
  const sensor = jest.spyOn(reanimated, 'useAnimatedSensor')
  renderCard()
  win()
  endPulse()
  expect(sensor).toHaveBeenCalledWith(SensorType.ROTATION, { interval: 'auto' })
})

it('with Reduce Motion on, shows at once and reads no sensor', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const sensor = jest.spyOn(reanimated, 'useAnimatedSensor')
  renderCard()
  win()
  expect(screen.getByTestId('finish')).toBeTruthy()
  expect(sensor).not.toHaveBeenCalled()
})
