import { MAX_ENTRIES_PER_SYNC } from '@sudoku/sync-contract'
import { devWarn } from '@/utils/log.utils'
import type { HistoryRecord } from './storage.types'
import { meetsContract } from './wireEntry'

/** The most entries that one batch reads from the waiting list to find valid entries. */
export const MAX_WAITING_SCAN = 1_000

/**
 * Reads one batch of valid entries from the waiting list (ADR-028). `read` gives the first `limit` entries of the list,
 * oldest change first. An entry that breaks the sync contract stays on the list, so the read goes deeper past it,
 * up to MAX_WAITING_SCAN rows. More invalid entries than that at the head block the rest. The app never deletes a
 * local entry for this.
 */
export async function readWaitingBatch(read: (limit: number) => Promise<HistoryRecord[]>): Promise<HistoryRecord[]> {
  let limit = MAX_ENTRIES_PER_SYNC
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each read is deeper than the one before.
    const waiting = await read(limit)
    const valid = waiting.filter(meetsContract)
    if (valid.length >= MAX_ENTRIES_PER_SYNC || waiting.length < limit || limit >= MAX_WAITING_SCAN) {
      if (valid.length < waiting.length) {
        devWarn('sync', 'A local entry breaks the sync contract, so it stays on the waiting list')
      }
      return valid.slice(0, MAX_ENTRIES_PER_SYNC)
    }
    limit = Math.min(limit * 2, MAX_WAITING_SCAN)
  }
}
