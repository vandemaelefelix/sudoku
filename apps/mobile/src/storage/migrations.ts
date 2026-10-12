import type { SqlDatabase } from './sql.types'

const LEVELS = "('easy', 'medium', 'hard', 'expert')"
const SOURCES = "('generated', 'scanned')"

/**
 * Migration N is the SQL at index N - 1. PRAGMA user_version holds the last migration that ran (ADR-012).
 * Append a new migration. Never change one that shipped.
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
]

/**
 * Runs each migration that is newer than the database, each in its own transaction.
 * Returns the schema version. Throws a RangeError, and writes nothing, when the database is newer than the app.
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
      // A second app start can migrate the same file at the same time. Only one of them runs each migration.
      const now = await txn.getFirstAsync<{ user_version: number }>('PRAGMA user_version', [])
      if ((now?.user_version ?? 0) >= next) return
      await txn.execAsync(source)
      await txn.execAsync(`PRAGMA user_version = ${next}`)
    })
  }
  return migrations.length
}
