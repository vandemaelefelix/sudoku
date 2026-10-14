import { createSqliteHistoryRepository } from './HistoryRepository'
import { createSqlitePuzzleRepository } from './PuzzleRepository'
import { createSqliteStatsRepository } from './StatsRepository'
import type { SqlDatabase } from './sql.types'
import type { GameStorage } from './gameStorage.types'
import type { StorageDeps } from './storage.types'

/** The database must be migrated first. */
export function createSqliteStorage(db: SqlDatabase, deps: StorageDeps): GameStorage {
  return {
    puzzles: createSqlitePuzzleRepository(db, deps),
    history: createSqliteHistoryRepository(db),
    stats: createSqliteStatsRepository(db, deps),
  }
}
