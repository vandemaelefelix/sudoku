import type { HistoryRepository } from './HistoryRepository'
import type { PuzzleRepository } from './PuzzleRepository'

export type GameStorage = {
  readonly puzzles: PuzzleRepository
  readonly history: HistoryRepository
}
