import { historyEntrySchema, type HistoryEntry as WireEntry } from '@sudoku/sync-contract'
import type { HistoryRecord } from './storage.types'

/** The return type makes `just typecheck` fail when the contract and the app history record drift apart. */
export function toWireEntry(record: HistoryRecord): WireEntry {
  return { schemaVersion: 1, ...record }
}

/** True when the record meets the sync contract, so the server accepts it. */
export function meetsContract(record: HistoryRecord): boolean {
  return historyEntrySchema.safeParse(toWireEntry(record)).success
}

/** Checks each change alone, so one bad entry cannot reject the page (ADR-028). It counts the dropped changes. */
export function parseChanges(changes: readonly unknown[]): { records: HistoryRecord[]; dropped: number } {
  const records: HistoryRecord[] = []
  let dropped = 0
  for (const change of changes) {
    const parsed = historyEntrySchema.safeParse(change)
    if (parsed.success) {
      const { schemaVersion: _schemaVersion, ...record } = parsed.data
      records.push(record)
    } else {
      dropped += 1
    }
  }
  return { records, dropped }
}
