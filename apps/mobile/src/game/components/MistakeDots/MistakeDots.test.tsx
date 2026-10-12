import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import type { ReactElement } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import type { Digit } from '@sudoku/core'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { daylight } from '@/theme/themes/daylight'
import { MistakeDots } from './MistakeDots'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

// Cell 2 is empty in the canvas puzzle. Its solution is 4.
function Moves() {
  const { select, digit, undo } = useGameActions()
  const enter = (value: Digit) => () => {
    select(2)
    digit(value)
  }
  return (
    <>
      <Pressable testID="right" onPress={enter(4)} />
      <Pressable testID="wrong" onPress={enter(5)} />
      <Pressable testID="undo" onPress={undo} />
    </>
  )
}

const renderWithMoves = () =>
  renderInGame(
    <>
      <MistakeDots />
      <Moves />
    </>,
  )

beforeEach(() => jest.mocked(Haptics.notificationAsync).mockClear())

it('draws three empty dots and reads the mistakes for VoiceOver', () => {
  renderInGame(<MistakeDots />)
  const dots = screen.getAllByTestId(/^mistake-dot-/)
  expect(dots).toHaveLength(3)
  expect(StyleSheet.flatten(dots[0]?.props.style)).toMatchObject({ borderColor: daylight.colors.textMuted })
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})

it('fills one dot and gives one warning haptic for a mistake', () => {
  renderWithMoves()
  fireEvent.press(screen.getByTestId('wrong'))
  expect(screen.getByLabelText('1 of 3 mistakes')).toBeTruthy()
  expect(StyleSheet.flatten(screen.getByTestId('mistake-dot-0').props.style)).toMatchObject({
    backgroundColor: daylight.colors.danger,
  })
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning)
})

it('gives no warning haptic for a right number or for undo', () => {
  renderWithMoves()
  fireEvent.press(screen.getByTestId('right'))
  fireEvent.press(screen.getByTestId('undo'))
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
})

it('gives no second warning when a later move is not a mistake', () => {
  renderWithMoves()
  fireEvent.press(screen.getByTestId('wrong'))
  fireEvent.press(screen.getByTestId('undo'))
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('1 of 3 mistakes')).toBeTruthy()
})
