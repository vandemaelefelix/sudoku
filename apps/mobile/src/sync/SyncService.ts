import type { HistoryRepository, SyncStateRepository } from '@/storage'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, MAX_FOLLOW_UP_RUNS } from './constants/sync.constants'
import type { SyncApi } from './syncApi'
import { runSync } from './syncRun'
import type { RunOutcome, RunResult, SyncSession, SyncStatus, SyncTrigger } from './sync.types'

export type SyncServiceDeps = {
  history: HistoryRepository
  state: SyncStateRepository
  api: SyncApi
  /** ISO 8601, UTC. */
  now(): string
  sleep(ms: number): Promise<void>
  /** Called once when the server answers 410. It removes the local data and signs out (ADR-028). */
  onAccountDeleted(owner: string): Promise<void>
}

export type SyncService = {
  /** Null means signed out. A new owner stops a run that is going on. */
  setSession(session: SyncSession | null): void
  /** Never throws. 'partial' means the run reached the most rounds and the follow-up runs did not finish: the next trigger goes on. 'ignored' means no run: no session, a wait after a failure, or nothing waits after a game end. */
  trigger(reason: SyncTrigger): Promise<RunResult | 'ignored'>
  subscribe(listener: () => void): () => void
  status(): SyncStatus
}

/**
 * The single-flight sync (ADR-028). One run at a time. A trigger during a run asks for one more run, never one per trigger.
 * A run that reaches the most rounds starts a bounded number of follow-up runs. After a failure, the wait doubles from 30 seconds to 15 minutes. Only a trigger retries: no timer runs.
 */
export function createSyncService(deps: SyncServiceDeps): SyncService {
  const { history, state, api, now, sleep, onAccountDeleted } = deps
  let session: SyncSession | null = null
  let generation = 0
  let deletedOwner: string | null = null
  let running: Promise<RunResult> | null = null
  let rerun = false
  let failures = 0
  let notBefore = 0
  let abort: AbortController | null = null
  let status: SyncStatus = { lastSyncedAt: null, revision: 0 }
  const listeners = new Set<() => void>()

  const setStatus = (next: SyncStatus) => {
    status = next
    for (const listener of listeners) listener()
  }

  const guard = (owner: string): SyncSession => {
    const mine = generation
    return {
      owner,
      getToken: () => session?.getToken() ?? Promise.resolve(null),
      isCurrent: () => generation === mine && session?.owner === owner,
    }
  }

  const runOnce = async (current: SyncSession): Promise<RunOutcome> => {
    try {
      abort = new AbortController()
      return await runSync({ history, state, api, session: guard(current.owner), now, sleep, signal: abort.signal })
    } catch (error) {
      devWarn('sync', `A sync run failed: ${errorMessage(error)}`)
      return { result: 'failed', changed: false, retryAfterMs: null }
    }
  }

  const handle = async (owner: string, outcome: RunOutcome, live: boolean): Promise<void> => {
    // A run of an old session must not touch the state of the new one. Only a 410 still needs its cleanup.
    if (!live && outcome.result !== 'deleted') return
    switch (outcome.result) {
      case 'synced':
        failures = 0
        notBefore = 0
        setStatus({ lastSyncedAt: now(), revision: status.revision + (outcome.changed ? 1 : 0) })
        break
      case 'failed': {
        failures += 1
        const wait = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS)
        notBefore = Date.parse(now()) + Math.max(wait, outcome.retryAfterMs ?? 0)
        if (outcome.changed) setStatus({ ...status, revision: status.revision + 1 })
        break
      }
      case 'deleted':
        deletedOwner = owner
        generation += 1
        session = null
        rerun = false
        try {
          await onAccountDeleted(owner)
        } catch (error) {
          devWarn('sync', `The deleted account was not cleaned up: ${errorMessage(error)}`)
        }
        setStatus({ lastSyncedAt: null, revision: status.revision })
        break
      default:
        if (outcome.changed) setStatus({ ...status, revision: status.revision + 1 })
    }
  }

  const loop = async (): Promise<RunResult> => {
    let last: RunResult = 'stopped'
    let followUps = 0
    for (;;) {
      rerun = false
      const current = session
      if (current === null) return 'stopped'
      const mine = generation
      // oxlint-disable-next-line no-await-in-loop -- runs never overlap.
      const outcome = await runOnce(current)
      last = outcome.result
      // oxlint-disable-next-line no-await-in-loop -- see above.
      await handle(current.owner, outcome, generation === mine && session === current)
      if (outcome.result === 'failed' || outcome.result === 'deleted') rerun = false
      // A run at the most rounds still has work. The follow-ups are bounded, so a server that never ends cannot loop.
      if (outcome.result === 'partial' && generation === mine && followUps < MAX_FOLLOW_UP_RUNS) {
        followUps += 1
        rerun = true
      }
      if (!rerun) return last
    }
  }

  return {
    setSession(next) {
      abort?.abort()
      generation += 1
      session = next
      rerun = false
      failures = 0
      notBefore = 0
      if (next === null) return
      const mine = generation
      void state.syncedAt(next.owner).then(
        (iso) => {
          if (generation === mine && status.lastSyncedAt !== iso) setStatus({ ...status, lastSyncedAt: iso })
        },
        () => undefined,
      )
      if (status.lastSyncedAt !== null) setStatus({ ...status, lastSyncedAt: null })
    },
    async trigger(reason) {
      const current = session
      if (current === null || current.owner === deletedOwner) return 'ignored'
      if (reason === 'game-end') {
        try {
          if ((await history.pending(current.owner, 1)).length === 0) return 'ignored'
        } catch {
          return 'failed'
        }
        if (session !== current) return 'ignored'
      }
      if (reason === 'network' || reason === 'sign-in') {
        failures = 0
        notBefore = 0
      } else if (Date.parse(now()) < notBefore) {
        return 'ignored'
      }
      if (running !== null) {
        rerun = true
        return running
      }
      running = loop().finally(() => {
        running = null
      })
      return running
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    status: () => status,
  }
}
