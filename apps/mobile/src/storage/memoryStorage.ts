import { fromSavedGame, hasMoves, toSavedGame, type SavedGame } from '@sudoku/core'
import type { BestTimes, HistoryRepository } from './HistoryRepository'
import { createMemoryStatsRepository } from './memoryStats'
import { resultOf, type PuzzleRepository } from './PuzzleRepository'
import type { GameStorage } from './gameStorage.types'
import type { HistoryEntry, Level, PuzzleSource, StorageDeps } from './storage.types'

type Progress = { id: string; level: Level; source: PuzzleSource; seed: number | null; saved: SavedGame }

/** A row of game_history. `seq` stands in for the rowid of SQLite, which breaks a tie in the order. */
type HistoryRow = {
  entry: HistoryEntry
  owner: string | null
  updatedAt: string
  deletedAt: string | null
  seq: number
}

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
  const rows: HistoryRow[] = []

  const insert = (entry: HistoryEntry, owner: string | null) => {
    rows.push({ entry, owner, updatedAt: entry.finishedAt, deletedAt: null, seq: rows.length })
  }

  /** The live entries of one owner, newest first, as `list` gives them. */
  const visible = (owner: string | null): HistoryEntry[] =>
    rows
      .filter((row) => row.deletedAt === null && row.owner === owner)
      .toSorted((a, b) => b.entry.finishedAt.localeCompare(a.entry.finishedAt) || b.seq - a.seq)
      .map((row) => row.entry)

  const load = () => {
    if (progress === null) return null
    const { id, level, source, seed, saved } = progress
    return { id, level, source, seed, game: fromSavedGame(saved) }
  }

  const puzzles: PuzzleRepository = {
    async start({ level, source, seed = null, game, owner }) {
      if (resultOf(game) !== null) throw new RangeError(`A ${game.status} game cannot start`)
      const replaced = load()
      if (replaced !== null && hasMoves(replaced.game)) {
        insert(
          {
            id: replaced.id,
            level: replaced.level,
            source: replaced.source,
            seed: replaced.seed,
            result: 'abandoned',
            playedMs: replaced.game.playedMs,
            mistakes: replaced.game.mistakes,
            hintsUsed: replaced.game.hintsUsed,
            finishedAt: deps.now(),
          },
          owner,
        )
      }
      progress = { id: deps.newId(), level, source, seed, saved: toSavedGame(game) }
      return { id: progress.id, level, source, seed, game }
    },
    async current() {
      return load()
    },
    async save(id, game, owner) {
      if (progress === null || progress.id !== id) return
      const result = resultOf(game)
      if (result === null) {
        progress = { ...progress, saved: toSavedGame(game) }
        return
      }
      insert(
        {
          id,
          level: progress.level,
          source: progress.source,
          seed: progress.seed,
          result,
          playedMs: game.playedMs,
          mistakes: game.mistakes,
          hintsUsed: game.hintsUsed,
          finishedAt: deps.now(),
        },
        owner,
      )
      progress = null
    },
    async discard(id) {
      if (progress?.id === id) progress = null
    },
    peek: load,
  }

  const history: HistoryRepository = {
    async clear(owner) {
      const now = deps.now()
      for (const row of rows) {
        if (row.deletedAt === null && row.owner === owner) Object.assign(row, { deletedAt: now, updatedAt: now })
      }
    },
    async list(owner) {
      return visible(owner)
    },
    async bestTimes(owner) {
      const best: BestTimes = {}
      for (const entry of visible(owner)) {
        const time = best[entry.level]
        const counts = entry.result === 'won' && entry.source === 'generated' && entry.hintsUsed === 0
        if (counts && (time === undefined || entry.playedMs < time)) {
          best[entry.level] = entry.playedMs
        }
      }
      return best
    },
  }

  return { puzzles, history, stats: createMemoryStatsRepository(visible, deps) }
}
