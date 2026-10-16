import type { Game } from '@sudoku/core'

export type Level = 'easy' | 'medium' | 'hard' | 'expert'
export type PuzzleSource = 'generated' | 'scanned'
export type GameResult = 'won' | 'lost' | 'abandoned'

export type SavedProgress = {
  readonly id: string
  readonly level: Level
  readonly source: PuzzleSource
  /** The seed of a generated puzzle (ADR-011). Null for a scanned puzzle and for a game saved before migration 3. */
  readonly seed: number | null
  readonly game: Game
}

export type HistoryEntry = {
  /** The id of the game in progress that finished. */
  readonly id: string
  readonly level: Level
  readonly source: PuzzleSource
  /** The seed of a generated puzzle (ADR-011). Null for a scanned puzzle and for a game saved before migration 3. */
  readonly seed: number | null
  readonly result: GameResult
  readonly playedMs: number
  readonly mistakes: number
  readonly hintsUsed: number
  /** ISO 8601, UTC. */
  readonly finishedAt: string
}

/** A history entry with the timestamps that the sync compares (ADR-028). All times are ISO 8601, UTC. */
export type HistoryRecord = HistoryEntry & {
  readonly createdAt: string
  readonly updatedAt: string
  /** Null for a live entry. A deleted entry still syncs, so other devices delete it too. */
  readonly deletedAt: string | null
}

/** Tests give fixed ids and times. The app gives UUIDs and the clock. */
export type StorageDeps = {
  newId: () => string
  /** ISO 8601, UTC. */
  now: () => string
}
