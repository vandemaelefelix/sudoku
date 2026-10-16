import type { HistoryRepository } from './HistoryRepository'
import type { PuzzleRepository } from './PuzzleRepository'
import type { StatsRepository } from './StatsRepository'
import type { SyncStateRepository } from './SyncStateRepository'

export type GameStorage = {
  readonly puzzles: PuzzleRepository
  readonly history: HistoryRepository
  readonly stats: StatsRepository
  readonly sync: SyncStateRepository
  /** Calls `listener` after a write that can change the history resolves. Returns the function that stops it. */
  subscribe(listener: () => void): () => void
}
