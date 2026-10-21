import type { SqlExecutor } from './sql.types'

// The keys of sync_state (ADR-028). SyncStateRepository and HistoryRepository both write them, so the keys and the
// SQL live here once. A write of a page, an answer to the adopt prompt and the delete of an owner each change
// history rows and these keys in one transaction.
export const CURSOR = 'cursor'
export const CURSOR_OWNER = 'cursorOwner'
export const syncedKey = (owner: string) => `syncedAt:${owner}`
export const adoptKey = (owner: string) => `adoptAsked:${owner}`

const SET_SQL =
  'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'

export async function readState(db: SqlExecutor, key: string): Promise<string | null> {
  return (
    (await db.getFirstAsync<{ value: string | null }>('SELECT value FROM sync_state WHERE key = ?', [key]))?.value ??
    null
  )
}

export async function writeState(db: SqlExecutor, key: string, value: string): Promise<void> {
  await db.runAsync(SET_SQL, [key, value])
}

/** The cursor and its owner change together. Call inside a transaction. */
export async function writeCursor(txn: SqlExecutor, owner: string, cursor: string): Promise<void> {
  await writeState(txn, CURSOR, cursor)
  await writeState(txn, CURSOR_OWNER, owner)
}

export async function dropCursor(db: SqlExecutor): Promise<void> {
  await db.runAsync('DELETE FROM sync_state WHERE key IN (?, ?)', [CURSOR, CURSOR_OWNER])
}

/** Forgets every value of one owner. The cursor goes only when it belongs to this owner. */
export async function forgetOwnerState(txn: SqlExecutor, owner: string): Promise<void> {
  await txn.runAsync('DELETE FROM sync_state WHERE key IN (?, ?)', [syncedKey(owner), adoptKey(owner)])
  if ((await readState(txn, CURSOR_OWNER)) === owner) await dropCursor(txn)
}
