import type { SqlExecutor } from './sql.types'
import type { GameResult, HistoryEntry, Level, PuzzleSource } from './storage.types'

/** The shortest time played of a won game without hints, per level. A level without such a game is missing. */
export type BestTimes = Partial<Record<Level, number>>

/** Finished and lost games (ADR-012). A game reaches the history through PuzzleRepository.save. */
export type HistoryRepository = {
  /** Newest first. */
  list(): Promise<HistoryEntry[]>
  bestTimes(): Promise<BestTimes>
}

type HistoryRow = {
  id: string
  level: Level
  source: PuzzleSource
  result: GameResult
  played_ms: number
  mistakes: number
  hints_used: number
  finished_at: string
}

/** Call inside the transaction of the last save, so the game and its history entry change together. */
export async function insertHistoryEntry(txn: SqlExecutor, entry: HistoryEntry): Promise<void> {
  await txn.runAsync(
    `INSERT INTO game_history
      (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.level,
      entry.source,
      entry.result,
      entry.playedMs,
      entry.mistakes,
      entry.hintsUsed,
      entry.finishedAt,
      entry.finishedAt,
      entry.finishedAt,
    ],
  )
}

export function createSqliteHistoryRepository(db: SqlExecutor): HistoryRepository {
  return {
    async list() {
      const rows = await db.getAllAsync<HistoryRow>(
        `SELECT id, level, source, result, played_ms, mistakes, hints_used, finished_at
          FROM game_history WHERE deleted_at IS NULL ORDER BY finished_at DESC, rowid DESC`,
        [],
      )
      return rows.map((row) => ({
        id: row.id,
        level: row.level,
        source: row.source,
        result: row.result,
        playedMs: row.played_ms,
        mistakes: row.mistakes,
        hintsUsed: row.hints_used,
        finishedAt: row.finished_at,
      }))
    },
    async bestTimes() {
      const rows = await db.getAllAsync<{ level: Level; best: number }>(
        `SELECT level, MIN(played_ms) AS best FROM game_history
          WHERE result = 'won' AND hints_used = 0 AND deleted_at IS NULL GROUP BY level`,
        [],
      )
      const best: BestTimes = {}
      for (const row of rows) best[row.level] = row.best
      return best
    },
  }
}
