import { toWireEntry, type HistoryRepository, type SyncStateRepository } from '@/storage'
import { MAX_ROUNDS, PAUSE_AFTER_ROUND, ROUND_PAUSE_MS } from './constants/sync.constants'
import type { SyncApi } from './syncApi'
import type { RunOutcome, SyncSession } from './sync.types'

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

/**
 * One sync run (ADR-028): push the waiting list in batches and pull every page. The run sends the requests, keeps the
 * rounds, the pause and the retries. The history repository applies each page and saves its cursor.
 * An API failure is a value, never a throw. A storage failure throws, and the service counts it as a failed run.
 */
export async function runSync(deps: RunDeps): Promise<RunOutcome> {
  const { history, state, api, session, now, sleep, signal } = deps
  const { owner } = session
  let cursor = await state.cursor(owner)
  let resets = 0
  let retriedAuth = false
  let changed = false
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    if (!session.isCurrent()) return outcome('stopped', changed)
    if (round > PAUSE_AFTER_ROUND) {
      // oxlint-disable-next-line no-await-in-loop -- the API throttle is per second.
      await sleep(ROUND_PAUSE_MS)
    }
    // oxlint-disable-next-line no-await-in-loop -- each round reads what the one before wrote.
    const waiting = await history.nextBatch(owner)
    // oxlint-disable-next-line no-await-in-loop -- Clerk gives a fresh token for each request.
    const token = await session.getToken(retriedAuth ? { fresh: true } : undefined)
    if (token === null) return outcome('skipped', changed)
    // oxlint-disable-next-line no-await-in-loop -- the next request needs the cursor of this one.
    const result = await api.sync({ entries: waiting.map(toWireEntry), cursor }, token, signal)
    if (!session.isCurrent()) return outcome('stopped', changed)
    switch (result.kind) {
      case 'ok': {
        retriedAuth = false
        const { acceptedIds, changes, cursor: next, more } = result.body
        // oxlint-disable-next-line no-await-in-loop -- the cursor moves only with the page that stores its entries.
        const page = await history.applySyncPage({ owner, sent: waiting, acceptedIds, changes, cursor: next })
        if (page.changed) changed = true
        cursor = next
        if (!more && !page.pushAgain) {
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
