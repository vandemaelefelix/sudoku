import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { Grid } from './Grid'

const renderGrid = () =>
  render(
    <GameProvider start={sampleStart()}>
      <Grid />
    </GameProvider>,
  )

it('draws 81 cells in nine boxes', () => {
  renderGrid()
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
  expect(screen.getAllByTestId(/^box-\d$/)).toHaveLength(9)
})

it('puts each cell in its box, row by row', () => {
  renderGrid()
  // Box 4 is the centre box. Its first cell is row 4, column 4: cell 30. Its last is cell 50.
  const box4 = within(screen.getByTestId('box-4'))
  expect(box4.getByTestId('cell-30')).toBeTruthy()
  expect(box4.getByTestId('cell-50')).toBeTruthy()
  expect(box4.queryByTestId('cell-0')).toBeNull()
})

it('selects a cell on a tap', () => {
  renderGrid()
  fireEvent.press(screen.getByTestId('cell-40'))
  expect(screen.getByLabelText('Row 5, column 5, empty')).toBeTruthy()
})
