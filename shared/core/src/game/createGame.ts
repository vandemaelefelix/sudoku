import { createEmptyGrid, GRID_CELLS } from '../grid'
import { isSolved } from './completion'
import type { Game } from './types'

export type NewGame = {
  givens: readonly number[]
  solution: readonly number[]
  /** Entries the player did not make, such as handwritten digits from a scan. Never mistakes. */
  entries?: readonly number[]
}

/** Throws a RangeError when the grids do not fit together. */
export function createGame({ givens, solution, entries }: NewGame): Game {
  const start = entries ?? createEmptyGrid()
  checkCells('givens', givens, 0)
  checkCells('solution', solution, 1)
  checkCells('entries', start, 0)
  for (let cell = 0; cell < GRID_CELLS; cell++) {
    const given = givens[cell] ?? 0
    if (given !== 0 && given !== solution[cell]) {
      throw new RangeError(`The given ${given} in cell ${cell} differs from the solution`)
    }
    if (given !== 0 && start[cell] !== 0) {
      throw new RangeError(`Cell ${cell} has a given and an entry`)
    }
  }
  const game: Game = {
    givens: [...givens],
    solution: [...solution],
    entries: [...start],
    startEntries: [...start],
    notes: start.map(() => []),
    selected: null,
    mistakes: 0,
    hintsUsed: 0,
    playedMs: 0,
    status: 'playing',
    undoSteps: [],
  }
  return isSolved(game) ? { ...game, status: 'won' } : game
}

function checkCells(name: string, cells: readonly number[], lowest: number): void {
  if (cells.length !== GRID_CELLS) {
    throw new RangeError(`The ${name} have ${cells.length} cells, not ${GRID_CELLS}`)
  }
  for (const value of cells) {
    if (!Number.isInteger(value) || value < lowest || value > 9) {
      throw new RangeError(`The ${name} hold ${value}, outside ${lowest} to 9`)
    }
  }
}
