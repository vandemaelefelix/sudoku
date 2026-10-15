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
  // SQLite does not promise the order of AND, but CASE checks json_valid first.
  `UPDATE game_in_progress
    SET saved_game = json_set(saved_game, '$.version', 2, '$.startEntries', json('${NO_START_ENTRIES}'))
    WHERE CASE WHEN json_valid(saved_game) THEN json_extract(saved_game, '$.version') END = 1;`,
  // A scanned game and a game saved before this migration have no seed (ADR-012, amendment "the seed").
  `ALTER TABLE game_in_progress ADD COLUMN seed INTEGER CHECK (seed IS NULL OR seed >= 0);
  ALTER TABLE game_history ADD COLUMN seed INTEGER CHECK (seed IS NULL OR seed >= 0);`,
  // SQLite cannot change a CHECK constraint, so the history table is built again with the result abandoned (ADR-023).
  `CREATE TABLE game_history_next (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL CHECK (level IN ${LEVELS}),
    source TEXT NOT NULL CHECK (source IN ${SOURCES}),
    result TEXT NOT NULL CHECK (result IN ('won', 'lost', 'abandoned')),
    played_ms INTEGER NOT NULL CHECK (played_ms >= 0),
    mistakes INTEGER NOT NULL CHECK (mistakes >= 0),
    hints_used INTEGER NOT NULL CHECK (hints_used >= 0),
    finished_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    seed INTEGER CHECK (seed IS NULL OR seed >= 0)
  );
  INSERT INTO game_history_next
    (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, deleted_at, seed)
    SELECT id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, deleted_at, seed
    FROM game_history ORDER BY rowid;
  DROP TABLE game_history;
  ALTER TABLE game_history_next RENAME TO game_history;
  CREATE INDEX game_history_best_time ON game_history (level, result, played_ms) WHERE deleted_at IS NULL;`,
  // The owner and the waiting list of the history sync (ADR-028). An owner of null is a game finished while signed out.
  // sync_state holds single values, such as the cursor, so it has no id or timestamps (ADR-028).
  `ALTER TABLE game_history ADD COLUMN owner_id TEXT;
  ALTER TABLE game_history ADD COLUMN pushed_at TEXT;
  CREATE INDEX game_history_owner ON game_history (owner_id, updated_at);
  CREATE TABLE sync_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );`,
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
