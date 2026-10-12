import type { HistoryEntry, Level } from './storage.types'

/** The shortest time played of a won game without hints, per level. A level without such a game is missing. */
export type BestTimes = Partial<Record<Level, number>>

/** Finished and lost games (ADR-012). A game reaches the history through PuzzleRepository.save. */
export type HistoryRepository = {
  /** Newest first. */
  list(): Promise<HistoryEntry[]>
  bestTimes(): Promise<BestTimes>
}
