import { fromSavedGame, hasMoves, toSavedGame, type SavedGame } from '@sudoku/core'
import type { BestTimes, HistoryRepository } from './HistoryRepository'
import { createMemoryStatsRepository } from './memoryStats'
import { resultOf, type PuzzleRepository } from './PuzzleRepository'
import type { GameStorage } from './gameStorage.types'
import type { HistoryEntry, Level, PuzzleSource, StorageDeps } from './storage.types'

type Progress = { id: string; level: Level; source: PuzzleSource; seed: number | null; saved: SavedGame }

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

  const load = () => {
    if (progress === null) return null
    const { id, level, source, seed, saved } = progress
    return { id, level, source, seed, game: fromSavedGame(saved) }
  }

  const puzzles: PuzzleRepository = {
    async start({ level, source, seed = null, game }) {
      if (resultOf(game) !== null) throw new RangeError(`A ${game.status} game cannot start`)
      const replaced = load()
      if (replaced !== null && hasMoves(replaced.game)) {
        entries.unshift({
          id: replaced.id,
          level: replaced.level,
          source: replaced.source,
          seed: replaced.seed,
          result: 'abandoned',
          playedMs: replaced.game.playedMs,
          mistakes: replaced.game.mistakes,
          hintsUsed: replaced.game.hintsUsed,
          finishedAt: deps.now(),
        })
      }
      progress = { id: deps.newId(), level, source, seed, saved: toSavedGame(game) }
      return { id: progress.id, level, source, seed, game }
    },
    async current() {
      return load()
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
        seed: progress.seed,
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
    peek: load,
  }

  const history: HistoryRepository = {
    async list() {
      return [...entries]
    },
    async bestTimes() {
      const best: BestTimes = {}
      for (const entry of entries) {
        const time = best[entry.level]
        const counts = entry.result === 'won' && entry.source === 'generated' && entry.hintsUsed === 0
        if (counts && (time === undefined || entry.playedMs < time)) {
          best[entry.level] = entry.playedMs
        }
      }
      return best
    },
  }

  return { puzzles, history, stats: createMemoryStatsRepository(() => entries, deps) }
}
