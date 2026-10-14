import type { HistoryRepository } from './HistoryRepository'
import type { PuzzleRepository } from './PuzzleRepository'
import type { StatsRepository } from './StatsRepository'

export type GameStorage = {
  readonly puzzles: PuzzleRepository
  readonly history: HistoryRepository
  readonly stats: StatsRepository
}
