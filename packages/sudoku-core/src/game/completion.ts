import type { Game } from './types'

export function valueAt(game: Game, cell: number): number {
  return (game.givens[cell] ?? 0) || (game.entries[cell] ?? 0)
}

function isCorrect(game: Game, cell: number): boolean {
  return valueAt(game, cell) === game.solution[cell]
}

export function isSolved(game: Game): boolean {
  return game.solution.every((_, cell) => isCorrect(game, cell))
}
