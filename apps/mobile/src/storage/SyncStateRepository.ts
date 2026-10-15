import type { SqlDatabase } from './sql.types'
import type { WriteQueue } from './writeQueue'

/**
 * The single values of the history sync (ADR-028): the cursor and the time of the last run. Each value belongs to an
 * owner, so one account never reads the state of another. The cursor is a string that the app never reads.
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
  /** True after the player answered the adopt prompt for this owner, with yes or no. */
  adoptAsked(owner: string): Promise<boolean>
  markAdoptAsked(owner: string): Promise<void>
  /** Forgets every value of this owner, for an account that the server deleted. */
  clear(owner: string): Promise<void>
}

const CURSOR = 'cursor'
const CURSOR_OWNER = 'cursorOwner'
const SYNCED_AT = 'syncedAt'
const adoptKey = (owner: string) => `adoptAsked:${owner}`
const syncedKey = (owner: string) => `${SYNCED_AT}:${owner}`

const SET_SQL =
  'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'

export function createSqliteSyncStateRepository(db: SqlDatabase, inOrder: WriteQueue): SyncStateRepository {
  const read = async (key: string) =>
    (await db.getFirstAsync<{ value: string | null }>('SELECT value FROM sync_state WHERE key = ?', [key]))?.value ??
    null
  const dropCursor = () => db.runAsync('DELETE FROM sync_state WHERE key IN (?, ?)', [CURSOR, CURSOR_OWNER])
  return {
    async cursor(owner) {
      const savedOwner = await read(CURSOR_OWNER)
      if (savedOwner === null) return null
      if (savedOwner !== owner) {
        await inOrder(async () => {
          await dropCursor()
        })
        return null
      }
      return read(CURSOR)
    },
    saveCursor: (owner, cursor) =>
      inOrder(() =>
        db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(SET_SQL, [CURSOR, cursor])
          await txn.runAsync(SET_SQL, [CURSOR_OWNER, owner])
        }),
      ),
    clearCursor: () =>
      inOrder(async () => {
        await dropCursor()
      }),
    syncedAt: (owner) => read(syncedKey(owner)),
    saveSyncedAt: (owner, iso) =>
      inOrder(async () => {
        await db.runAsync(SET_SQL, [syncedKey(owner), iso])
      }),
    adoptAsked: async (owner) => (await read(adoptKey(owner))) !== null,
    markAdoptAsked: (owner) =>
      inOrder(async () => {
        await db.runAsync(SET_SQL, [adoptKey(owner), '1'])
      }),
    clear: (owner) =>
      inOrder(async () => {
        await db.runAsync('DELETE FROM sync_state WHERE key IN (?, ?)', [syncedKey(owner), adoptKey(owner)])
        if ((await read(CURSOR_OWNER)) === owner) await dropCursor()
      }),
  }
}

/** The in-memory fake of the sync state for Jest. It keeps the rules of the SQLite version. */
export function createMemorySyncStateRepository(): SyncStateRepository {
  const values = new Map<string, string>()
  const dropCursor = () => {
    values.delete(CURSOR)
    values.delete(CURSOR_OWNER)
  }
  return {
    async cursor(owner) {
      const savedOwner = values.get(CURSOR_OWNER)
      if (savedOwner === undefined) return null
      if (savedOwner !== owner) {
        dropCursor()
        return null
      }
      return values.get(CURSOR) ?? null
    },
    async saveCursor(owner, cursor) {
      values.set(CURSOR, cursor)
      values.set(CURSOR_OWNER, owner)
    },
    async clearCursor() {
      dropCursor()
    },
    async syncedAt(owner) {
      return values.get(syncedKey(owner)) ?? null
    },
    async saveSyncedAt(owner, iso) {
      values.set(syncedKey(owner), iso)
    },
    async adoptAsked(owner) {
      return values.has(adoptKey(owner))
    },
    async markAdoptAsked(owner) {
      values.set(adoptKey(owner), '1')
    },
    async clear(owner) {
      values.delete(syncedKey(owner))
      values.delete(adoptKey(owner))
      if (values.get(CURSOR_OWNER) === owner) dropCursor()
    },
  }
}
