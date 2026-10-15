import type { SqlDatabase, SqlExecutor } from './sql.types'
import type { GameResult, HistoryEntry, Level, PuzzleSource, StorageDeps } from './storage.types'
import type { WriteQueue } from './writeQueue'

/** The shortest time played of a won generated game without hints, per level (ADR-012). A level without such a game is missing. */
export type BestTimes = Partial<Record<Level, number>>

/**
 * Finished and lost games (ADR-012). A game reaches the history through PuzzleRepository.save.
 * Every entry has an owner: an account id, or null for a game finished while signed out (ADR-028).
 * Each method sees only the entries of the owner it gets.
 */
export type HistoryRepository = {
  /** Newest first. */
  list(owner: string | null): Promise<HistoryEntry[]>
  bestTimes(owner: string | null): Promise<BestTimes>
  /**
   * Removes every entry of the owner from the list and the stats. The rows stay as soft deletes (ADR-012),
   * and the game in progress stays. The development variant offers it to reset the stats while testing.
   */
  clear(owner: string | null): Promise<void>
}

type HistoryRow = {
  id: string
  level: Level
  source: PuzzleSource
  seed: number | null
  result: GameResult
  played_ms: number
  mistakes: number
  hints_used: number
  finished_at: string
}

/** Call inside the transaction of the last save, so the game and its history entry change together. */
export async function insertHistoryEntry(txn: SqlExecutor, entry: HistoryEntry, owner: string | null): Promise<void> {
  await txn.runAsync(
    `INSERT INTO game_history
      (id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, owner_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.level,
      entry.source,
      entry.seed,
      entry.result,
      entry.playedMs,
      entry.mistakes,
      entry.hintsUsed,
      entry.finishedAt,
      entry.finishedAt,
      entry.finishedAt,
      owner,
    ],
  )
}

/** `inOrder` is the write queue of the connection, shared with the other repositories. Reads skip it. */
export function createSqliteHistoryRepository(
  db: SqlDatabase,
  deps: StorageDeps,
  inOrder: WriteQueue,
): HistoryRepository {
  return {
    clear: (owner) =>
      inOrder(async () => {
        const now = deps.now()
        await db.runAsync(
          'UPDATE game_history SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND owner_user_id IS ?',
          [now, now, owner],
        )
      }),
    async list(owner) {
      const rows = await db.getAllAsync<HistoryRow>(
        `SELECT id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at
          FROM game_history WHERE deleted_at IS NULL AND owner_user_id IS ? ORDER BY finished_at DESC, rowid DESC`,
        [owner],
      )
      return rows.map((row) => ({
        id: row.id,
        level: row.level,
        source: row.source,
        seed: row.seed,
        result: row.result,
        playedMs: row.played_ms,
        mistakes: row.mistakes,
        hintsUsed: row.hints_used,
        finishedAt: row.finished_at,
      }))
    },
    async bestTimes(owner) {
      const rows = await db.getAllAsync<{ level: Level; best: number }>(
        `SELECT level, MIN(played_ms) AS best FROM game_history
          WHERE result = 'won' AND hints_used = 0 AND source = 'generated' AND deleted_at IS NULL AND owner_user_id IS ?
          GROUP BY level`,
        [owner],
      )
      const best: BestTimes = {}
      for (const row of rows) best[row.level] = row.best
      return best
    },
  }
}
