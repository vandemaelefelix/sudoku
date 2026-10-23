import type { SqlExecutor } from './sql.types'
import type { HistoryEntry, HistoryRecord } from './storage.types'

export const ENTRY_COLUMNS = 'id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at'

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
export const CLEAR_SQL = `UPDATE game_history
  SET deleted_at = ?, updated_at = MAX(?, strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds'))
  WHERE deleted_at IS NULL AND owner_id IS ?`

// A row of another owner never changes: the WHERE of the DO UPDATE also compares the owner.
export const UPSERT_SQL = `INSERT INTO game_history
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
export const MARK_PUSHED_SQL = `UPDATE game_history SET pushed_at = updated_at
  WHERE EXISTS (
    SELECT 1 FROM json_each(?) AS pair
      WHERE json_extract(pair.value, '$[0]') = game_history.id
        AND json_extract(pair.value, '$[1]') = game_history.updated_at
  )`

// The server holds this change already, so only the waiting list changes (ADR-028).
export const SAME_CHANGE_SQL = `UPDATE game_history SET pushed_at = updated_at
  WHERE id = ? AND updated_at = ? AND owner_id IS ?`

export const WAITING_WHERE = 'owner_id = ? AND (pushed_at IS NULL OR pushed_at <> updated_at)'

/**
 * The 14 values of UPSERT_SQL for one downloaded entry, in the order of its columns. The server has this change, so
 * pushed_at is the updatedAt: the entry is off the waiting list (ADR-028).
 */
export function recordParams(record: HistoryRecord, owner: string): (string | number | null)[] {
  return [
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
    record.updatedAt,
  ]
}

export const hasWaiting = async (executor: SqlExecutor, owner: string) =>
  (await executor.getFirstAsync(`SELECT 1 FROM game_history WHERE ${WAITING_WHERE} LIMIT 1`, [owner])) !== null

export const countUnowned = async (executor: SqlExecutor) =>
  (
    await executor.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM game_history WHERE owner_id IS NULL AND deleted_at IS NULL',
      [],
    )
  )?.total ?? 0
