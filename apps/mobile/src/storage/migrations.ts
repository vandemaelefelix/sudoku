import { createEmptyGrid } from '@sudoku/core'
import type { SqlDatabase } from './sql.types'

const LEVELS = "('easy', 'medium', 'hard', 'expert')"
const SOURCES = "('generated', 'scanned')"
/** A saved game of version 1 has no record of its start entries, so version 2 gets none. */
const NO_START_ENTRIES = JSON.stringify(createEmptyGrid())

/**
 * Migration N is the SQL at index N - 1. PRAGMA user_version holds the last migration that ran (ADR-012).
 * Append a new migration. Never change one that shipped.
 * A new SAVED_GAME_VERSION needs a migration that converts `saved_game`, or the game in progress does not load.
 */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE game_in_progress (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL CHECK (level IN ${LEVELS}),
    source TEXT NOT NULL CHECK (source IN ${SOURCES}),
    saved_game TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE game_history (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL CHECK (level IN ${LEVELS}),
    source TEXT NOT NULL CHECK (source IN ${SOURCES}),
    result TEXT NOT NULL CHECK (result IN ('won', 'lost')),
    played_ms INTEGER NOT NULL CHECK (played_ms >= 0),
    mistakes INTEGER NOT NULL CHECK (mistakes >= 0),
    hints_used INTEGER NOT NULL CHECK (hints_used >= 0),
    finished_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX game_history_best_time ON game_history (level, result, played_ms) WHERE deleted_at IS NULL;`,
  // json_extract throws on a damaged saved game, and that failure would stop every app start.
  `UPDATE game_in_progress
    SET saved_game = json_set(saved_game, '$.version', 2, '$.startEntries', json('${NO_START_ENTRIES}'))
    WHERE json_valid(saved_game) AND json_extract(saved_game, '$.version') = 1;`,
]

/**
 * Runs each migration that is newer than the database, each in its own transaction.
 * Returns the schema version. Throws a RangeError, and writes nothing, when the database is newer than the app.
 * Throws "database is locked" when another connection migrates at the same time. A new call then continues.
 */
export async function migrate(db: SqlDatabase, migrations: readonly string[] = MIGRATIONS): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', [])
  const current = row?.user_version ?? 0
  if (current > migrations.length) {
    throw new RangeError(`The database version ${current} is newer than this app (${migrations.length})`)
  }
  for (const [index, source] of migrations.slice(current).entries()) {
    const next = current + index + 1
    // oxlint-disable-next-line no-await-in-loop -- each migration builds on the schema of the one before it.
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Another connection can run this migration after the read above, so read the version again.
      // While that connection writes, this transaction fails with "database is locked" and writes nothing.
      const now = await txn.getFirstAsync<{ user_version: number }>('PRAGMA user_version', [])
      if ((now?.user_version ?? 0) >= next) return
      await txn.execAsync(source)
      await txn.execAsync(`PRAGMA user_version = ${next}`)
    })
  }
  return migrations.length
}
