import { GRID_CELLS, valueAt, type Game } from '@sudoku/core'

/** The cells whose given or entry matches the solution. Givens count, as on the design canvas. */
export function rightCells(game: Game): number {
  let right = 0
  for (let cell = 0; cell < GRID_CELLS; cell++) {
    if (valueAt(game, cell) === game.solution[cell]) right += 1
  }
  return right
}
