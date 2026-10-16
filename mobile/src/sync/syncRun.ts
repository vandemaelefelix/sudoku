import { historyEntrySchema } from '@sudoku/sync-contract'
import type { HistoryRecord, HistoryRepository, SyncStateRepository } from '@/storage'
import { devWarn } from '@/utils/log.utils'
import { BATCH_SIZE, MAX_PENDING_SCAN, MAX_ROUNDS, PAUSE_AFTER_ROUND, ROUND_PAUSE_MS } from './constants/sync.constants'
import type { SyncApi } from './syncApi'
import type { RunOutcome, SyncSession } from './sync.types'
import { parseChanges, toWireEntry } from './wireEntry'

export type RunDeps = {
  history: HistoryRepository
  state: SyncStateRepository
  api: SyncApi
  session: SyncSession
  /** Aborts the request that is in flight. */
  signal?: AbortSignal
  /** ISO 8601, UTC. */
  now(): string
  sleep(ms: number): Promise<void>
}

const outcome = (result: RunOutcome['result'], changed: boolean, retryAfterMs: number | null = null): RunOutcome => ({
  result,
  changed,
  retryAfterMs,
})

const isConstraintError = (error: unknown) => error instanceof Error && /constraint/i.test(error.message)

/**
 * Writes a page of downloaded entries. When the database refuses the page for a broken CHECK, it writes the entries
 * one by one and drops the ones that break it, so one bad entry cannot block the cursor (ADR-028).
 * Any other failure throws and keeps the cursor.
 */
async function applyChanges(history: HistoryRepository, records: HistoryRecord[], owner: string): Promise<void> {
  try {
    await history.upsertRemote(records, owner)
    return
  } catch (error) {
    if (!isConstraintError(error)) throw error
  }
  for (const record of records) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- each entry is its own transaction, in order.
      await history.upsertRemote([record], owner)
    } catch (error) {
      if (!isConstraintError(error)) throw error
      devWarn('sync', 'The database refused one downloaded entry, so it was dropped')
    }
  }
}

/**
 * Reads one batch of valid entries from the waiting list. An entry that breaks the contract stays on the list, so
 * the read goes deeper past it, up to MAX_PENDING_SCAN rows. More invalid entries than that at the head block the
 * rest (ADR-028). The app never deletes a local entry for this.
 */
async function nextBatch(history: HistoryRepository, owner: string): Promise<HistoryRecord[]> {
  let limit = BATCH_SIZE
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each read is deeper than the one before.
    const pending = await history.pending(owner, limit)
    const valid = pending.filter((record) => historyEntrySchema.safeParse(toWireEntry(record)).success)
    if (valid.length >= BATCH_SIZE || pending.length < limit || limit >= MAX_PENDING_SCAN) {
      if (valid.length < pending.length)
        devWarn('sync', 'A local entry breaks the sync contract, so it stays on the waiting list')
      return valid.slice(0, BATCH_SIZE)
    }
    limit = Math.min(limit * 2, MAX_PENDING_SCAN)
  }
}

/**
 * One sync run (ADR-028): push the waiting list in batches, pull every page, and save the cursor after each page.
 * An API failure is a value, never a throw. A storage failure throws, and the service counts it as a failed run.
 */
export async function runSync(deps: RunDeps): Promise<RunOutcome> {
  const { history, state, api, session, now, sleep, signal } = deps
  const { owner } = session
  let cursor = await state.cursor(owner)
  let resets = 0
  let retriedAuth = false
  let changed = false
  const sent = new Set<string>()
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    if (!session.isCurrent()) return outcome('stopped', changed)
    if (round > PAUSE_AFTER_ROUND) {
      // oxlint-disable-next-line no-await-in-loop -- the API throttle is per second.
      await sleep(ROUND_PAUSE_MS)
    }
    // oxlint-disable-next-line no-await-in-loop -- each round reads what the one before wrote.
    const waiting = await nextBatch(history, owner)
    // oxlint-disable-next-line no-await-in-loop -- Clerk gives a fresh token for each request.
    const token = await session.getToken(retriedAuth ? { fresh: true } : undefined)
    if (token === null) return outcome('skipped', changed)
    for (const record of waiting) sent.add(record.id)
    // oxlint-disable-next-line no-await-in-loop -- the next request needs the cursor of this one.
    const result = await api.sync({ entries: waiting.map(toWireEntry), cursor }, token, signal)
    if (!session.isCurrent()) return outcome('stopped', changed)
    switch (result.kind) {
      case 'ok': {
        retriedAuth = false
        const { acceptedIds, changes, cursor: next, more } = result.body
        const accepted = new Set(acceptedIds)
        const pairs = waiting.filter((record) => accepted.has(record.id))
        // oxlint-disable-next-line no-await-in-loop -- the pairs are the ones that were SENT, with their updatedAt.
        await history.markPushed(pairs.map(({ id, updatedAt }) => ({ id, updatedAt })))
        const { records, dropped } = parseChanges(changes)
        if (dropped > 0) devWarn('sync', `${dropped} downloaded entries break the sync contract and were dropped`)
        // oxlint-disable-next-line no-await-in-loop -- the cursor moves only after the page is stored.
        await applyChanges(history, records, owner)
        if (records.some((record) => !sent.has(record.id))) changed = true
        // oxlint-disable-next-line no-await-in-loop -- see above.
        await state.saveCursor(owner, next)
        cursor = next
        // oxlint-disable-next-line no-await-in-loop -- the waiting list changed with markPushed.
        const waitingStill = pairs.length > 0 && (await history.pending(owner, 1)).length > 0
        if (!more && !waitingStill) {
          // oxlint-disable-next-line no-await-in-loop -- the run ends here.
          await state.saveSyncedAt(owner, now())
          return session.isCurrent() ? outcome('synced', changed) : outcome('stopped', changed)
        }
        break
      }
      case 'cursor_invalid': {
        resets += 1
        if (resets > 1) return outcome('failed', changed)
        // oxlint-disable-next-line no-await-in-loop -- a full pull starts from a clean cursor.
        await state.clearCursor()
        cursor = null
        break
      }
      case 'unauthorized': {
        // ADR-028: one retry at once with a fresh token. A second 401 in a row is a failure.
        if (retriedAuth) return outcome('failed', changed)
        retriedAuth = true
        break
      }
      case 'account_deleted':
        return outcome('deleted', changed)
      case 'throttled':
        return outcome('failed', changed, result.retryAfterMs)
      default:
        return outcome('failed', changed)
    }
  }
  return outcome('partial', changed)
}
