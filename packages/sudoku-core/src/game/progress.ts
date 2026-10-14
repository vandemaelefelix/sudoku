import type { Game } from './types'

/**
 * True when the player edited the grid, made a mistake or used a hint. Undo gives back an edit but never a mistake or a hint,
 * so a game that the player undid back to its start can still have moves (ADR-023).
 */
export function hasMoves(game: Game): boolean {
  return game.undoSteps.length > 0 || game.mistakes > 0 || game.hintsUsed > 0
}
