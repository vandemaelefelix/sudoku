import { render, screen } from '@testing-library/react-native'
import { createGame } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { CardGrid } from './CardGrid'

it('draws all 81 cells with the given or the entry of each cell', () => {
  const { givens, solution } = sampleStart()
  const entries = solution.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
  render(<CardGrid board={createGame({ givens, solution, entries })} />)
  const cells = screen.getAllByTestId(/^card-cell-\d+$/, { includeHiddenElements: true })
  expect(cells).toHaveLength(81)
  expect(cells.map((cell) => cell.props.children)).toEqual(solution)
})

// Nine cells of 11.11 % width wrapped after eight on an iPhone, so the grid is nine rows of nine cells.
it('lays the cells out as nine rows of nine', () => {
  const { givens, solution } = sampleStart()
  render(<CardGrid board={createGame({ givens, solution })} />)
  const rows = screen.getAllByTestId(/^card-row-\d$/, { includeHiddenElements: true })
  expect(rows).toHaveLength(9)
  for (const row of rows) expect(row.children).toHaveLength(9)
})

it('hides the grid from VoiceOver: the card label says the result', () => {
  const { givens, solution } = sampleStart()
  render(<CardGrid board={createGame({ givens, solution })} />)
  expect(screen.getByTestId('card-grid', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true)
})
