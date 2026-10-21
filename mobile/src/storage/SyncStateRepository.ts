import type { SqlDatabase } from './sql.types'
import { CURSOR, CURSOR_OWNER, dropCursor, readState, syncedKey, writeCursor, writeState } from './syncStateSql'
import type { WriteQueue } from './writeQueue'

/**
 * The single values of the history sync (ADR-028): the cursor and the time of the last run. Each value belongs to an
 * owner, so one account never reads the state of another. The cursor is a string that the app never reads.
 * `HistoryRepository.applySyncPage` saves the cursor with the page, and `deleteOwner` clears the values of an owner.
 */
export type SyncStateRepository = {
  /** The saved cursor of this owner, or null. Another owner gets null and the old cursor goes (ADR-028, decision 3). */
  cursor(owner: string): Promise<string | null>
  /** Writes the cursor and its owner together. */
  saveCursor(owner: string, cursor: string): Promise<void>
  /** Forgets the cursor, so the next run is a full pull. It keeps every other value. */
  clearCursor(): Promise<void>
  /** ISO 8601 time of the last finished run of this owner. It is a value, not a row timestamp. */
  syncedAt(owner: string): Promise<string | null>
  saveSyncedAt(owner: string, iso: string): Promise<void>
}

export function createSqliteSyncStateRepository(db: SqlDatabase, inOrder: WriteQueue): SyncStateRepository {
  return {
    async cursor(owner) {
      const savedOwner = await readState(db, CURSOR_OWNER)
      if (savedOwner === null) return null
      if (savedOwner !== owner) {
        await inOrder(() => dropCursor(db))
        return null
      }
      return readState(db, CURSOR)
    },
    saveCursor: (owner, cursor) =>
      inOrder(() => db.withExclusiveTransactionAsync((txn) => writeCursor(txn, owner, cursor))),
    clearCursor: () => inOrder(() => dropCursor(db)),
    syncedAt: (owner) => readState(db, syncedKey(owner)),
    saveSyncedAt: (owner, iso) => inOrder(() => writeState(db, syncedKey(owner), iso)),
  }
}

/**
 * The in-memory fake of the sync state for Jest. It keeps the rules of the SQLite version.
 * `values` is the table. The in-memory history shares it, as the SQLite history shares the table.
 */
export function createMemorySyncStateRepository(values: Map<string, string> = new Map()): SyncStateRepository {
  const drop = () => {
    values.delete(CURSOR)
    values.delete(CURSOR_OWNER)
  }
  return {
    async cursor(owner) {
      const savedOwner = values.get(CURSOR_OWNER)
      if (savedOwner === undefined) return null
      if (savedOwner !== owner) {
        drop()
        return null
      }
      return values.get(CURSOR) ?? null
    },
    async saveCursor(owner, cursor) {
      values.set(CURSOR, cursor)
      values.set(CURSOR_OWNER, owner)
    },
    async clearCursor() {
      drop()
    },
    async syncedAt(owner) {
      return values.get(syncedKey(owner)) ?? null
    },
    async saveSyncedAt(owner, iso) {
      values.set(syncedKey(owner), iso)
    },
  }
}
