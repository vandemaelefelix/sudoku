import { historyEntrySchema, type HistoryEntry } from '@sudoku/sync-contract'
import { GAME_PREFIX, gameSk, userPk } from './tableDesign'

// The game row of ADR-028 decision 9. The id lives only in sk.
export function toGameItem(userId: string, entry: HistoryEntry, syncedAt: string): Record<string, unknown> {
  const { id, ...fields } = entry
  return { pk: userPk(userId), sk: gameSk(id), ...fields, syncedAt }
}

// The schema strips pk, sk, syncedAt and expiresAt, so the server fields never reach the wire.
export function fromGameItem(item: Record<string, unknown>): HistoryEntry {
  return historyEntrySchema.parse({ ...item, id: String(item.sk).slice(GAME_PREFIX.length) })
}
