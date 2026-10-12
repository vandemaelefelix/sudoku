import { randomUUID } from 'expo-crypto'
import { openDatabaseAsync } from 'expo-sqlite'
import { migrate } from './migrations'
import { createSqliteStorage } from './sqliteStorage'
import type { GameStorage } from './gameStorage.types'

const DATABASE_NAME = 'sudoku.db'

// One storage per app: its queue keeps the saves in order only on its own connection (ADR-012).
let opening: Promise<GameStorage> | null = null

/**
 * Opens the app database and brings its schema up to date (ADR-012). Every call gives the same storage.
 * After a failed open, the next call tries again.
 */
export function openStorage(): Promise<GameStorage> {
  if (opening === null) {
    opening = open()
    opening.catch(() => {
      opening = null
    })
  }
  return opening
}

async function open(): Promise<GameStorage> {
  const db = await openDatabaseAsync(DATABASE_NAME)
  await db.execAsync('PRAGMA journal_mode = WAL')
  await migrate(db)
  return createSqliteStorage(db, { newId: randomUUID, now: () => new Date().toISOString() })
}
