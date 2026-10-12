import { BOXES, COLUMNS, ROWS } from '../units'
import type { Completion, Digit, Game } from './types'

export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const NOTHING_COMPLETED: Completion = {
  rows: [],
  columns: [],
  boxes: [],
  digits: [],
  grid: false,
}

/** The given or the entry of a cell. 0 when the cell is empty. */
export function valueAt(game: Game, cell: number): number {
  return (game.givens[cell] ?? 0) || (game.entries[cell] ?? 0)
}

function isCorrect(game: Game, cell: number): boolean {
  return valueAt(game, cell) === game.solution[cell]
}

export function isWrong(game: Game, cell: number): boolean {
  return valueAt(game, cell) !== 0 && !isCorrect(game, cell)
}

export function isSolved(game: Game): boolean {
  return game.solution.every((_, cell) => isCorrect(game, cell))
}

/** The numbers with nine correct cells. A wrong placement does not count. */
export function completeDigits(game: Game): Digit[] {
  const counts = new Map<number, number>()
  game.solution.forEach((_, cell) => {
    if (isCorrect(game, cell)) {
      const value = valueAt(game, cell)
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  })
  return DIGITS.filter((digit) => counts.get(digit) === 9)
}

function completeUnits(game: Game, units: readonly (readonly number[])[]): number[] {
  return units.flatMap((cells, index) =>
    cells.every((cell) => isCorrect(game, cell)) ? [index] : [],
  )
}

function added<T>(before: readonly T[], after: readonly T[]): T[] {
  return after.filter((item) => !before.includes(item))
}

/** What is complete in `after` and was not complete in `before`. */
export function completedBetween(before: Game, after: Game): Completion {
  return {
    rows: added(completeUnits(before, ROWS), completeUnits(after, ROWS)),
    columns: added(completeUnits(before, COLUMNS), completeUnits(after, COLUMNS)),
    boxes: added(completeUnits(before, BOXES), completeUnits(after, BOXES)),
    digits: added(completeDigits(before), completeDigits(after)),
    grid: !isSolved(before) && isSolved(after),
  }
}
