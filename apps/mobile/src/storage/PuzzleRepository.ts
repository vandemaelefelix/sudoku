import type { Game } from '@sudoku/core'
import type { GameResult, Level, PuzzleSource, SavedProgress } from './storage.types'

/** The game in progress (ADR-012). Screens use this interface, never SQL. */
export type PuzzleRepository = {
  /** Starts a game in progress and discards the one before it. Throws a RangeError for a won or lost game. */
  start(input: { level: Level; source: PuzzleSource; game: Game }): Promise<SavedProgress>
  /** The game in progress, or null. A saved game that no longer loads is discarded and gives null. */
  current(): Promise<SavedProgress | null>
  /**
   * Saves the game after a move. A won or lost game moves to the history in the same transaction.
   * Does nothing when `id` is not the game in progress.
   */
  save(id: string, game: Game): Promise<void>
  discard(id: string): Promise<void>
}

export function resultOf(game: Game): GameResult | null {
  return game.status === 'won' || game.status === 'lost' ? game.status : null
}
