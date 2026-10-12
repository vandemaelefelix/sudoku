import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { Board } from './Board'

it('keeps the grid square in the smaller side', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Board />
    </GameProvider>,
  )
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 300 } } })
  expect(StyleSheet.flatten(screen.getByTestId('board-square').props.style)).toMatchObject({ width: 300, height: 300 })
})
