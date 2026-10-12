import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { daylight } from '@/theme/themes/daylight'
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

it('reads the time for VoiceOver in an area of 44 pt that has no action', () => {
  renderInGame(<TimerPill />)
  const area = screen.getByLabelText('Time 00:00')
  expect(area.props.accessible).toBe(true)
  expect(area.props.onPress).toBeUndefined()
  expect(StyleSheet.flatten(area.props.style)).toMatchObject({ minHeight: 44 })
})

it('mutes the time and drops the pause icon when the game ends', () => {
  renderInGame(
    <>
      <TimerPill />
      <LoseButton />
    </>,
  )
  expect(screen.getByTestId('skia-path')).toBeTruthy()
  fireEvent.press(screen.getByTestId('lose'))
  expect(screen.queryByTestId('skia-path')).toBeNull()
  expect(StyleSheet.flatten(screen.getByText('00:00').props.style)).toMatchObject({
    color: daylight.colors.textMuted,
  })
})
