import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { Pressable, StyleSheet } from 'react-native'
import { DisplayGameProvider } from '@/game/components/DisplayGameProvider'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { reduceSession, startSession } from '@/game/utils/session.utils'
import { cobalt } from '@/theme/themes/cobalt'
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
  const selected = { backgroundColor: cobalt.components.cell.selected }
  expect(StyleSheet.flatten(screen.getByTestId('cell-40').props.style)).not.toMatchObject(selected)
  fireEvent.press(screen.getByTestId('cell-40'))
  expect(StyleSheet.flatten(screen.getByTestId('cell-40').props.style)).toMatchObject(selected)
})

it('shows a board that cannot be tapped and that VoiceOver skips', () => {
  const board = reduceSession(startSession(sampleStart()), { type: 'select', cell: 40 }).game
  render(
    <DisplayGameProvider board={board}>
      <Grid interactive={false} digitSize="small" />
    </DisplayGameProvider>,
  )
  const hidden = { includeHiddenElements: true }
  expect(screen.getAllByTestId(/^cell-\d+$/, hidden)).toHaveLength(81)
  expect(screen.queryAllByRole('button', hidden)).toHaveLength(0)
  expect(screen.queryAllByTestId(/^cell-\d+-wave$/, hidden)).toHaveLength(0)
  expect(screen.getByTestId('grid', hidden).props.accessibilityElementsHidden).toBe(true)
})

it('keeps the game grid open to VoiceOver by default', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Grid />
    </GameProvider>,
  )
  expect(screen.getByTestId('grid').props.accessibilityElementsHidden).toBe(false)
  expect(screen.getAllByRole('button')).toHaveLength(81)
  expect(screen.getAllByTestId(/^cell-\d+-wave$/)).toHaveLength(81)
})

function Moves() {
  const { select, digit, undo, hint, hintCard } = useGameActions()
  return (
    <>
      <Pressable
        testID="wrong"
        onPress={() => {
          select(2)
          digit(5)
        }}
      />
      <Pressable testID="undo" onPress={undo} />
      <Pressable testID="hint" onPress={hint} />
      <Pressable
        testID="fill"
        onPress={() => {
          hint()
          hintCard('hintAnswer')
          hintCard('hintFill')
        }}
      />
    </>
  )
}

const renderWithMoves = () =>
  render(
    <GameProvider start={sampleStart()}>
      <Grid />
      <Moves />
    </GameProvider>,
  )

describe('the mark of the last move', () => {
  it('glows on the cell that a hint fills', () => {
    renderWithMoves()
    fireEvent.press(screen.getByTestId('fill'))
    expect(screen.getAllByTestId('cell-flash-hint')).toHaveLength(1)
  })

  it('flashes the cell that an undo restored, and the flash leaves with the next move', () => {
    renderWithMoves()
    fireEvent.press(screen.getByTestId('wrong'))
    expect(screen.queryByTestId(/^cell-flash-/)).toBeNull()
    fireEvent.press(screen.getByTestId('undo'))
    expect(within(screen.getByTestId('cell-2')).getByTestId('cell-flash-undo')).toBeTruthy()
    fireEvent.press(screen.getByTestId('fill'))
    expect(screen.queryByTestId('cell-flash-undo')).toBeNull()
  })
})

describe('the hint fills (ADR-032)', () => {
  it('fills the nine cells of the focus unit on the look rung, and nothing else', () => {
    renderWithMoves()
    fireEvent.press(screen.getByTestId('hint'))
    expect(screen.getAllByTestId(/^cell-\d+-hint-focus$/)).toHaveLength(9)
    expect(screen.queryAllByTestId(/^cell-\d+-hint-(pattern|target)$/)).toHaveLength(0)
  })
})
