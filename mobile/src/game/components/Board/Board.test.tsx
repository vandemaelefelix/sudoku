import { fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { Board } from './Board'

function PauseButton() {
  const { pause } = useGameActions()
  return <Pressable testID="pause" onPress={pause} />
}

it('keeps the grid square in the smaller side', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Board />
    </GameProvider>,
  )
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 300 } } })
  expect(StyleSheet.flatten(screen.getByTestId('board-square').props.style)).toMatchObject({ width: 300, height: 300 })
})

it('lays the pause layer over the grid during a pause', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Board />
      <PauseButton />
    </GameProvider>,
  )
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })
  fireEvent.press(screen.getByTestId('pause'))
  const layer = screen.getByRole('button', { name: 'Paused, tap to resume' })
  expect(screen.getByTestId('board-square')).toContainElement(layer)
  // The grid stays under the layer, but the modal layer hides it from VoiceOver.
  expect(screen.getByTestId('cell-2', { includeHiddenElements: true })).toBeTruthy()
  expect(screen.queryByTestId('cell-2')).toBeNull()
})
