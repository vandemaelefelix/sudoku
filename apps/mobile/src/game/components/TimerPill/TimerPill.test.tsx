import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import type { ReactElement } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { cobalt } from '@/theme/themes/cobalt'
import { TimerPill } from './TimerPill'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

// Three wrong numbers in cell 2, whose solution is 4, lose the game.
function LoseButton() {
  const { select, digit } = useGameActions()
  const lose = () => {
    select(2)
    for (const wrong of [5, 6, 7] as const) digit(wrong)
  }
  return <Pressable testID="lose" onPress={lose} />
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('shows the time played', () => {
  renderInGame(<TimerPill />)
  expect(screen.getByText('00:00')).toBeTruthy()
  act(() => jest.advanceTimersByTime(65_000))
  expect(screen.getByText('01:05')).toBeTruthy()
})

it('is a button of 44 pt that pauses the game', () => {
  renderInGame(<TimerPill />)
  const button = screen.getByRole('button', { name: 'Pause, time 00:00' })
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 44 })
  fireEvent.press(button)
  expect(screen.getByRole('button', { name: 'Resume, time 00:00' })).toBeTruthy()
})

it('stops the time during a pause and counts again after resume', () => {
  renderInGame(<TimerPill />)
  act(() => jest.advanceTimersByTime(2000))
  fireEvent.press(screen.getByRole('button', { name: 'Pause, time 00:02' }))
  act(() => jest.advanceTimersByTime(30_000))
  expect(screen.getByText('00:02')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Resume, time 00:02' }))
  act(() => jest.advanceTimersByTime(1000))
  expect(screen.getByText('00:03')).toBeTruthy()
})

it('counts the part second before a pause', () => {
  renderInGame(<TimerPill />)
  act(() => jest.advanceTimersByTime(2500))
  fireEvent.press(screen.getByRole('button', { name: 'Pause, time 00:02' }))
  fireEvent.press(screen.getByRole('button', { name: 'Resume, time 00:02' }))
  act(() => jest.advanceTimersByTime(500))
  fireEvent.press(screen.getByRole('button', { name: 'Pause, time 00:02' }))
  expect(screen.getByRole('button', { name: 'Resume, time 00:03' })).toBeTruthy()
})

it('fills the pill with the accent and shows the play icon during a pause', () => {
  renderInGame(<TimerPill />)
  fireEvent.press(screen.getByRole('button', { name: 'Pause, time 00:00' }))
  // The Reanimated mock reads the shared values in render, and the fade starts in an effect after the press.
  screen.rerender(<GameProvider start={sampleStart()}>{<TimerPill />}</GameProvider>)
  expect(StyleSheet.flatten(screen.getByTestId('timer-pill-fill').props.style)).toMatchObject({
    backgroundColor: cobalt.colors.accent,
    opacity: 1,
  })
  // The time takes onAccent through interpolateColor, which the Reanimated mock does not compute.
  expect(screen.getAllByTestId('skia-path').map((path) => path.props.path)).toContain('M8 5l11 7-11 7z')
})

it('draws the pill border and the pause icon while the game is playing', () => {
  renderInGame(<TimerPill />)
  expect(StyleSheet.flatten(screen.getByTestId('timer-pill').props.style)).toMatchObject({
    borderColor: cobalt.colors.line,
  })
  expect(StyleSheet.flatten(screen.getByTestId('timer-pill-fill').props.style)).toMatchObject({ opacity: 0 })
  expect(screen.getAllByTestId('skia-path')[0]?.props.path).toBe('M9 5v14M15 5v14')
})

it('mutes the time, drops the icon and has no action when the game ends', () => {
  renderInGame(
    <>
      <TimerPill />
      <LoseButton />
    </>,
  )
  fireEvent.press(screen.getByTestId('lose'))
  expect(screen.queryByTestId('skia-path')).toBeNull()
  expect(screen.queryByRole('button', { name: /time/ })).toBeNull()
  const area = screen.getByLabelText('Time 00:00')
  expect(area.props.accessible).toBe(true)
  expect(StyleSheet.flatten(area.props.style)).toMatchObject({ minHeight: 44 })
  expect(StyleSheet.flatten(screen.getByText('00:00').props.style)).toMatchObject({
    color: cobalt.colors.textMuted,
  })
  const pill = StyleSheet.flatten(screen.getByTestId('timer-pill').props.style)
  expect(pill.borderWidth ?? 0).toBe(0)
})

it('plays a soft haptic for pause and for resume', () => {
  renderInGame(<TimerPill />)
  jest.mocked(Haptics.impactAsync).mockClear()
  fireEvent.press(screen.getByRole('button', { name: 'Pause, time 00:00' }))
  fireEvent.press(screen.getByRole('button', { name: 'Resume, time 00:00' }))
  expect(jest.mocked(Haptics.impactAsync).mock.calls).toEqual([['soft'], ['soft']])
})
