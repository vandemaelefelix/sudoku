import { fromSavedGame, toSavedGame, type SavedGame } from '@sudoku/core'
import type { BestTimes, HistoryRepository } from './HistoryRepository'
import { resultOf, type PuzzleRepository } from './PuzzleRepository'
import type { GameStorage } from './gameStorage.types'
import type { HistoryEntry, Level, PuzzleSource, StorageDeps } from './storage.types'

type Progress = { id: string; level: Level; source: PuzzleSource; saved: SavedGame }

function countingDeps(): StorageDeps {
  let ids = 0
  let seconds = 0
  return {
    newId: () => `game-${++ids}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds++)).toISOString(),
  }
}

/** The in-memory fake of the game storage for Jest (ADR-012). It keeps the rules of the SQLite repositories. */
export function createMemoryStorage(deps: StorageDeps = countingDeps()): GameStorage {
  let progress: Progress | null = null
  // Newest first.
  const entries: HistoryEntry[] = []

  const puzzles: PuzzleRepository = {
    async start({ level, source, game }) {
      if (resultOf(game) !== null) throw new RangeError(`A ${game.status} game cannot start`)
      progress = { id: deps.newId(), level, source, saved: toSavedGame(game) }
      return { id: progress.id, level, source, game }
    },
    async current() {
      if (progress === null) return null
      return { id: progress.id, level: progress.level, source: progress.source, game: fromSavedGame(progress.saved) }
    },
    async save(id, game) {
      if (progress === null || progress.id !== id) return
      const result = resultOf(game)
      if (result === null) {
        progress = { ...progress, saved: toSavedGame(game) }
        return
      }
      entries.unshift({
        id,
        level: progress.level,
        source: progress.source,
        result,
        playedMs: game.playedMs,
        mistakes: game.mistakes,
        hintsUsed: game.hintsUsed,
        finishedAt: deps.now(),
      })
      progress = null
    },
    async discard(id) {
      if (progress?.id === id) progress = null
    },
  }

  const history: HistoryRepository = {
    async list() {
      return [...entries]
    },
    async bestTimes() {
      const best: BestTimes = {}
      for (const entry of entries) {
        const time = best[entry.level]
        if (entry.result === 'won' && entry.hintsUsed === 0 && (time === undefined || entry.playedMs < time)) {
          best[entry.level] = entry.playedMs
        }
      }
      return best
    },
  }

  return { puzzles, history }
}
