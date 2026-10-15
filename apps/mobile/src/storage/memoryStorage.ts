import { fromSavedGame, hasMoves, toSavedGame, type SavedGame } from '@sudoku/core'
import type { BestTimes, HistoryRepository } from './HistoryRepository'
import { createMemoryStatsRepository } from './memoryStats'
import { createMemorySyncStateRepository } from './SyncStateRepository'
import { withChangeNotice } from './changeNotice'
import { resultOf, type PuzzleRepository } from './PuzzleRepository'
import type { GameStorage } from './gameStorage.types'
import type { HistoryEntry, HistoryRecord, Level, PuzzleSource, StorageDeps } from './storage.types'

type Progress = { id: string; level: Level; source: PuzzleSource; seed: number | null; saved: SavedGame }

/** A row of game_history. `seq` stands in for the rowid of SQLite, which breaks a tie in the order. */
type HistoryRow = { record: HistoryRecord; owner: string | null; pushedAt: string | null; seq: number }

function entryOf({ createdAt: _createdAt, updatedAt: _updatedAt, deletedAt: _deletedAt, ...entry }: HistoryRecord) {
  return entry
}

/** One millisecond after `iso`, as the SQL of the clear computes it. */
function nextMillisecond(iso: string): string {
  return new Date(Date.parse(iso) + 1).toISOString()
}

function isPending(row: HistoryRow): boolean {
  return row.pushedAt !== row.record.updatedAt
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
    const at = entry.finishedAt
    rows.push({
      record: { ...entry, createdAt: at, updatedAt: at, deletedAt: null },
      owner,
      pushedAt: null,
      seq: rows.length,
    })
  }

  /** The live entries of one owner, newest first, as `list` gives them. */
  const visible = (owner: string | null): HistoryEntry[] =>
    rows
      .filter((row) => row.record.deletedAt === null && row.owner === owner)
      .toSorted((a, b) => b.record.finishedAt.localeCompare(a.record.finishedAt) || b.seq - a.seq)
      .map((row) => entryOf(row.record))

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
        if (row.record.deletedAt !== null || row.owner !== owner) continue
        const next = nextMillisecond(row.record.updatedAt)
        row.record = { ...row.record, deletedAt: now, updatedAt: now > next ? now : next }
      }
    },
    async pending(owner, limit) {
      return rows
        .filter((row) => row.owner === owner && isPending(row))
        .toSorted((a, b) => a.record.updatedAt.localeCompare(b.record.updatedAt) || a.seq - b.seq)
        .slice(0, limit)
        .map((row) => row.record)
    },
    async markPushed(pushed) {
      for (const row of rows) {
        const accepted = pushed.some(({ id, updatedAt }) => id === row.record.id && updatedAt === row.record.updatedAt)
        if (accepted) row.pushedAt = row.record.updatedAt
      }
    },
    async upsertRemote(records, owner) {
      for (const record of records) {
        const row = rows.find((candidate) => candidate.record.id === record.id)
        if (row === undefined) {
          rows.push({ record, owner, pushedAt: record.updatedAt, seq: rows.length })
        } else if (row.owner === owner && record.updatedAt >= row.record.updatedAt) {
          if (record.updatedAt > row.record.updatedAt) row.record = record
          row.pushedAt = record.updatedAt
        }
      }
    },
    async adoptUnowned(owner) {
      const adopted = rows.filter((row) => row.owner === null && row.record.deletedAt === null)
      for (const row of adopted) row.owner = owner
      return adopted.length
    },
    async countUnowned() {
      return rows.filter((row) => row.owner === null && row.record.deletedAt === null).length
    },
    async deleteOwner(owner) {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index]?.owner === owner) rows.splice(index, 1)
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

  return withChangeNotice({
    puzzles,
    history,
    stats: createMemoryStatsRepository(visible, deps),
    sync: createMemorySyncStateRepository(),
  })
}
