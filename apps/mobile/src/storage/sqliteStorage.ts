import { createSqliteHistoryRepository } from './HistoryRepository'
import { createSqlitePuzzleRepository } from './PuzzleRepository'
import { createSqliteStatsRepository } from './StatsRepository'
import type { SqlDatabase } from './sql.types'
import type { GameStorage } from './gameStorage.types'
import type { StorageDeps } from './storage.types'
import { createWriteQueue } from './writeQueue'

/** The database must be migrated first. Every write of the repositories goes through one queue (ADR-012). */
export function createSqliteStorage(db: SqlDatabase, deps: StorageDeps): GameStorage {
  const inOrder = createWriteQueue()
  return {
    puzzles: createSqlitePuzzleRepository(db, deps, inOrder),
    history: createSqliteHistoryRepository(db, deps, inOrder),
    stats: createSqliteStatsRepository(db, deps),
  }
}
