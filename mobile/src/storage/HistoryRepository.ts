import type { SqlDatabase, SqlExecutor } from './sql.types'
import type { GameResult, HistoryEntry, HistoryRecord, Level, PuzzleSource, StorageDeps } from './storage.types'
import type { WriteQueue } from './writeQueue'

/** The shortest time played of a won generated game without hints, per level (ADR-012). A level without such a game is missing. */
export type BestTimes = Partial<Record<Level, number>>

/**
 * Finished and lost games (ADR-012). A game reaches the history through PuzzleRepository.save.
 * Every entry has an owner: the Clerk user ID, or null for a game finished while signed out (ADR-028).
 * Each method sees only the entries of the owner it gets.
 */
export type HistoryRepository = {
  /** Newest first. */
  list(owner: string | null): Promise<HistoryEntry[]>
  bestTimes(owner: string | null): Promise<BestTimes>
  /**
   * Removes every entry of the owner from the list and the stats. The rows stay as soft deletes (ADR-012),
   * and the game in progress stays. The development variant offers it to reset the stats while testing.
   * Each removed entry gets a newer updatedAt, so it goes back on the waiting list (ADR-028).
   */
  clear(owner: string | null): Promise<void>
  /**
   * The waiting list (ADR-028): the entries of the owner where pushed_at is null or differs from updated_at.
   * Includes deleted entries. The oldest change comes first. At most `limit` entries.
   */
  pending(owner: string, limit: number): Promise<HistoryRecord[]>
  /**
   * Records the pairs that the server accepted (ADR-028): pushed_at becomes updatedAt only where the row
   * still has that updatedAt. So an entry that changes during the request stays on the waiting list,
   * and a repeated call changes nothing. Unknown ids change nothing.
   */
  markPushed(pushed: readonly Pick<HistoryRecord, 'id' | 'updatedAt'>[]): Promise<void>
  /**
   * Writes the entries from the server, all in one transaction (ADR-028). An entry is written only when its id
   * is new, or when its updatedAt is newer and the row has the same owner. A written entry is off the waiting list.
   * An entry with an equal updatedAt changes only pushed_at, so it is off the waiting list too.
   * A deleted entry is written too, so an older copy cannot bring it back. Rejects, and writes nothing,
   * when one entry breaks a CHECK.
   */
  upsertRemote(records: readonly HistoryRecord[], owner: string): Promise<void>
  /**
   * Gives every live entry without an owner to `owner` (ADR-028), and returns their count.
   * Deleted entries keep no owner, so they never sync.
   */
  adoptUnowned(owner: string): Promise<number>
  /** The count of live entries without an owner. The adopt prompt asks it before it adopts (ADR-028). */
  countUnowned(): Promise<number>
  /**
   * Deletes every row of the owner for good, live or deleted (ADR-028, decision 3). The server deleted the account,
   * so nothing of it may stay. It is the only hard delete of the history.
   */
  deleteOwner(owner: string): Promise<void>
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

type RecordRow = HistoryRow & { created_at: string; updated_at: string; deleted_at: string | null }

const ENTRY_COLUMNS = 'id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at'

function entryOf(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    level: row.level,
    source: row.source,
    seed: row.seed,
    result: row.result,
    playedMs: row.played_ms,
    mistakes: row.mistakes,
    hintsUsed: row.hints_used,
    finishedAt: row.finished_at,
  }
}

/** Call inside the transaction of the last save, so the game and its history entry change together. */
export async function insertHistoryEntry(txn: SqlExecutor, entry: HistoryEntry, owner: string | null): Promise<void> {
  await txn.runAsync(
    `INSERT INTO game_history
      (id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, owner_id)
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

// A change from a device with a clock ahead can leave updated_at after now. The clear still moves it forward
// by 1 ms, so the deleted entry goes back on the waiting list and wins on the server (ADR-028).
const CLEAR_SQL = `UPDATE game_history
  SET deleted_at = ?, updated_at = MAX(?, strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds'))
  WHERE deleted_at IS NULL AND owner_id IS ?`

// A row of another owner never changes: the WHERE of the DO UPDATE also compares the owner.
const UPSERT_SQL = `INSERT INTO game_history
    (id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at,
      created_at, updated_at, deleted_at, owner_id, pushed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    level = excluded.level,
    source = excluded.source,
    seed = excluded.seed,
    result = excluded.result,
    played_ms = excluded.played_ms,
    mistakes = excluded.mistakes,
    hints_used = excluded.hints_used,
    finished_at = excluded.finished_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    pushed_at = excluded.pushed_at
  WHERE excluded.updated_at > game_history.updated_at
    AND game_history.owner_id IS excluded.owner_id`

// pushed_at holds the accepted updatedAt, never a clock time. A row that changed since keeps waiting (ADR-028).
const MARK_PUSHED_SQL = `UPDATE game_history SET pushed_at = updated_at
  WHERE EXISTS (
    SELECT 1 FROM json_each(?) AS pair
      WHERE json_extract(pair.value, '$[0]') = game_history.id
        AND json_extract(pair.value, '$[1]') = game_history.updated_at
  )`

// The server holds this change already, so only the waiting list changes (ADR-028).
const SAME_CHANGE_SQL = `UPDATE game_history SET pushed_at = updated_at
  WHERE id = ? AND updated_at = ? AND owner_id IS ?`

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
        await db.runAsync(CLEAR_SQL, [now, now, owner])
      }),
    async list(owner) {
      const rows = await db.getAllAsync<HistoryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM game_history
          WHERE deleted_at IS NULL AND owner_id IS ? ORDER BY finished_at DESC, rowid DESC`,
        [owner],
      )
      return rows.map(entryOf)
    },
    async bestTimes(owner) {
      // The WHERE clause is countsForBestTime in SQL (ADR-023). The contract suite keeps both equal.
      const rows = await db.getAllAsync<{ level: Level; best: number }>(
        `SELECT level, MIN(played_ms) AS best FROM game_history
          WHERE result = 'won' AND hints_used = 0 AND source = 'generated' AND deleted_at IS NULL AND owner_id IS ?
          GROUP BY level`,
        [owner],
      )
      const best: BestTimes = {}
      for (const row of rows) best[row.level] = row.best
      return best
    },
    async pending(owner, limit) {
      const rows = await db.getAllAsync<RecordRow>(
        `SELECT ${ENTRY_COLUMNS}, created_at, updated_at, deleted_at FROM game_history
          WHERE owner_id = ? AND (pushed_at IS NULL OR pushed_at <> updated_at)
          ORDER BY updated_at ASC, rowid ASC LIMIT ?`,
        [owner, limit],
      )
      return rows.map((row) => ({
        ...entryOf(row),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      }))
    },
    markPushed: (pushed) =>
      inOrder(async () => {
        await db.runAsync(MARK_PUSHED_SQL, [JSON.stringify(pushed.map(({ id, updatedAt }) => [id, updatedAt]))])
      }),
    upsertRemote: (records, owner) =>
      inOrder(() =>
        db.withExclusiveTransactionAsync(async (txn) => {
          for (const record of records) {
            // oxlint-disable-next-line no-await-in-loop -- two copies of one id in a batch must apply in order.
            await txn.runAsync(UPSERT_SQL, [
              record.id,
              record.level,
              record.source,
              record.seed,
              record.result,
              record.playedMs,
              record.mistakes,
              record.hintsUsed,
              record.finishedAt,
              record.createdAt,
              record.updatedAt,
              record.deletedAt,
              owner,
              // The server has this change, so the entry is off the waiting list (ADR-028).
              record.updatedAt,
            ])
            // oxlint-disable-next-line no-await-in-loop -- this runs after the upsert of the same id.
            await txn.runAsync(SAME_CHANGE_SQL, [record.id, record.updatedAt, owner])
          }
        }),
      ),
    adoptUnowned: (owner) =>
      inOrder(async () => {
        const { changes } = await db.runAsync(
          'UPDATE game_history SET owner_id = ? WHERE owner_id IS NULL AND deleted_at IS NULL',
          [owner],
        )
        return changes
      }),
    async countUnowned() {
      const row = await db.getFirstAsync<{ total: number }>(
        'SELECT COUNT(*) AS total FROM game_history WHERE owner_id IS NULL AND deleted_at IS NULL',
        [],
      )
      return row?.total ?? 0
    },
    deleteOwner: (owner) =>
      inOrder(async () => {
        await db.runAsync('DELETE FROM game_history WHERE owner_id = ?', [owner])
      }),
  }
}
