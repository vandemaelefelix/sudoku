import { fireEvent, render, screen, within } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import type { NewGame } from '@sudoku/core'
import { GameProvider } from '@/game/components/GameProvider'
import { Grid } from '@/game/components/Grid'
import { Tools } from '@/game/components/Tools'
import { sampleStart } from '@/game/utils/sample.utils'
import { Keypad } from './Keypad'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

it('lays out the keys 1 to 5 and 6 to 9 in two rows', () => {
  renderInGame(<Keypad />)
  const first = within(screen.getByTestId('keypad-row-0')).getAllByRole('button')
  const second = within(screen.getByTestId('keypad-row-1')).getAllByRole('button')
  expect(first.map((key) => key.props.accessibilityLabel)).toEqual([
    'Enter 1',
    'Enter 2',
    'Enter 3',
    'Enter 4',
    'Enter 5',
  ])
  expect(second).toHaveLength(4)
})

it('makes each key 64 × 60 pt', () => {
  renderInGame(<Keypad />)
  expect(screen.getByLabelText('Enter 1')).toHaveStyle({ width: 64, height: 60 })
})

const sample = sampleStart()
const emptyFours = sample.solution.flatMap((value, cell) => (sample.givens[cell] === 0 && value === 4 ? [cell] : []))
const LAST_FOUR = emptyFours[0] ?? 0

/** Every 4 is placed except the one in LAST_FOUR. */
const oneFourOpen = (): NewGame => ({
  ...sample,
  entries: sample.solution.map((value, cell) => (emptyFours.includes(cell) && cell !== LAST_FOUR ? value : 0)),
})

const renderGame = (start: NewGame) =>
  render(
    <GameProvider start={start}>
      <Grid />
      <Tools />
      <Keypad />
    </GameProvider>,
  )

const placeLastFour = () => {
  fireEvent.press(screen.getByTestId(`cell-${LAST_FOUR}`))
  fireEvent.press(screen.getByLabelText('Enter 4'))
}

it('disables a key when all nine of its number are correct', () => {
  renderGame(oneFourOpen())
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
  placeLastFour()
  expect(screen.getByLabelText('Enter 4, all nine placed')).toBeDisabled()
  expect(screen.getByLabelText('Enter 5')).toBeEnabled()
})

it('does not count a wrong placement', () => {
  renderGame(oneFourOpen())
  const wrongCell = sample.givens.findIndex(
    (given, cell) => given === 0 && sample.solution[cell] !== 4 && !emptyFours.includes(cell),
  )
  fireEvent.press(screen.getByTestId(`cell-${wrongCell}`))
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
})

it('enables the key again after Undo', () => {
  renderGame(oneFourOpen())
  placeLastFour()
  fireEvent.press(screen.getByLabelText('Undo'))
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
})

it('enables the key again after Erase', () => {
  renderGame(oneFourOpen())
  placeLastFour()
  fireEvent.press(screen.getByLabelText('Erase'))
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
})

it('starts a resumed game with the key of a complete number disabled', () => {
  renderGame({ ...sample, entries: sample.solution.map((value, cell) => (emptyFours.includes(cell) ? value : 0)) })
  expect(screen.getByLabelText('Enter 4, all nine placed')).toBeDisabled()
})
