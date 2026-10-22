import { countsForBestTime, fromSavedGame, hasMoves, toSavedGame, type SavedGame } from '@sudoku/core'
import type { BestTimes, HistoryRepository } from './HistoryRepository'
import { createMemoryStatsRepository } from './memoryStats'
import { createMemorySyncStateRepository, forgetMemoryOwnerState, writeMemoryCursor } from './SyncStateRepository'
import { adoptKey } from './syncStateSql'
import { readWaitingBatch } from './waitingBatch'
import { parseChanges } from './wireEntry'
import { withChangeNotice } from './changeNotice'
import { resultOf, type PuzzleRepository } from './PuzzleRepository'
import type { GameStorage } from './gameStorage.types'
import type { HistoryEntry, HistoryRecord, Level, PuzzleSource, StorageDeps } from './storage.types'
import { devWarn } from '@/utils/log.utils'

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
  // The table sync_state. The history shares it with the sync state, as the SQLite repositories do.
  const state = new Map<string, string>()

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
      .sort((a, b) => b.record.finishedAt.localeCompare(a.record.finishedAt) || b.seq - a.seq)
      .map((row) => entryOf(row.record))

  const unowned = () => rows.filter((row) => row.owner === null && row.record.deletedAt === null)

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
    nextBatch: (owner) =>
      readWaitingBatch(async (limit) =>
        rows
          .filter((row) => row.owner === owner && isPending(row))
          .sort((a, b) => a.record.updatedAt.localeCompare(b.record.updatedAt) || a.seq - b.seq)
          .slice(0, limit)
          .map((row) => row.record),
      ),
    async hasWaiting(owner) {
      return rows.some((row) => row.owner === owner && isPending(row))
    },
    async applySyncPage({ owner, sent, acceptedIds, changes, cursor }) {
      const accepted = new Set(acceptedIds)
      const pushed = sent.filter(({ id }) => accepted.has(id))
      const { records, dropped } = parseChanges(changes)
      if (dropped > 0) devWarn('sync', `${dropped} downloaded entries break the sync contract and were dropped`)
      for (const row of rows) {
        const marked = pushed.some(({ id, updatedAt }) => id === row.record.id && updatedAt === row.record.updatedAt)
        if (marked) row.pushedAt = row.record.updatedAt
      }
      let changed = false
      for (const record of records) {
        const row = rows.find((candidate) => candidate.record.id === record.id)
        if (row === undefined) {
          rows.push({ record, owner, pushedAt: record.updatedAt, seq: rows.length })
          changed = true
        } else if (row.owner === owner && record.updatedAt >= row.record.updatedAt) {
          if (record.updatedAt > row.record.updatedAt) {
            row.record = record
            changed = true
          }
          row.pushedAt = record.updatedAt
        }
      }
      writeMemoryCursor(state, owner, cursor)
      return { changed, pushAgain: pushed.length > 0 && rows.some((row) => row.owner === owner && isPending(row)) }
    },
    async adoptable(owner) {
      return state.has(adoptKey(owner)) ? 0 : unowned().length
    },
    async answerAdopt(owner, accepted) {
      const adopted = accepted ? unowned() : []
      for (const row of adopted) row.owner = owner
      state.set(adoptKey(owner), '1')
      return adopted.length
    },
    async deleteOwner(owner) {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index]?.owner === owner) rows.splice(index, 1)
      }
      forgetMemoryOwnerState(state, owner)
    },
    async list(owner) {
      return visible(owner)
    },
    async bestTimes(owner) {
      const best: BestTimes = {}
      for (const entry of visible(owner)) {
        const time = best[entry.level]
        if (countsForBestTime(entry) && (time === undefined || entry.playedMs < time)) {
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
    sync: createMemorySyncStateRepository(state),
  })
}
