import { randomUUID } from 'expo-crypto'
import { openDatabaseAsync } from 'expo-sqlite'
import { migrate } from './migrations'
import { createSqliteStorage } from './sqliteStorage'
import type { GameStorage } from './gameStorage.types'

const DATABASE_NAME = 'sudoku.db'

/** Opens the app database and brings its schema up to date (ADR-012). Call it once, at app start. */
export async function openStorage(): Promise<GameStorage> {
  const db = await openDatabaseAsync(DATABASE_NAME)
  await db.execAsync('PRAGMA journal_mode = WAL')
  await migrate(db)
  return createSqliteStorage(db, { newId: randomUUID, now: () => new Date().toISOString() })
}
