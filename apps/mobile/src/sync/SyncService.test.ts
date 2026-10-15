import type { GameStorage } from '@/storage'
import { createSyncService } from './SyncService'
import type { SyncApi } from './syncApi'
import { ALICE, BOB, createTestStorage, fakeServer, finishGame, noSleep, scriptedApi } from './syncTestKit'
import type { SyncApiResult, SyncSession } from './sync.types'

let storage: GameStorage
let clock: number

beforeEach(() => {
  storage = createTestStorage()
  clock = Date.parse('2026-10-15T12:00:00.000Z')
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

const OK: SyncApiResult = { kind: 'ok', body: { acceptedIds: [], changes: [], cursor: 'c', more: false } }
const FAIL: SyncApiResult = { kind: 'offline' }

function sessionOf(owner: string): SyncSession & { stop(): void } {
  return { owner, getToken: async () => owner, isCurrent: () => true, stop() {} }
}

function serviceWith(api: SyncApi, onAccountDeleted = jest.fn(async () => undefined)) {
  const service = createSyncService({
    history: storage.history,
    state: storage.sync,
    api,
    now: () => new Date(clock).toISOString(),
    sleep: noSleep,
    onAccountDeleted,
  })
  return { service, onAccountDeleted }
}

/** An API that answers only when the test releases it. */
function gatedApi() {
  const waiting: ((result: SyncApiResult) => void)[] = []
  const api: SyncApi = { sync: () => new Promise((resolve) => waiting.push(resolve)) }
  return { api, waiting, release: (result: SyncApiResult = OK) => waiting.shift()?.(result) }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('without a session', () => {
  it('ignores every trigger', async () => {
    const { api, requests } = scriptedApi([OK])
    const { service } = serviceWith(api)
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    expect(requests).toHaveLength(0)
  })

  it('ignores a trigger after the session ends', async () => {
    const { api, requests } = scriptedApi([OK])
    const { service } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    service.setSession(null)
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    expect(requests).toHaveLength(0)
  })
})

describe('triggers', () => {
  it('runs a sync and tells the status', async () => {
    const { api } = scriptedApi([OK])
    const { service } = serviceWith(api)
    const heard = jest.fn()
    service.subscribe(heard)
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('sign-in')).resolves.toBe('synced')
    expect(service.status()).toEqual({ lastSyncedAt: '2026-10-15T12:00:00.000Z', revision: 0 })
    expect(heard).toHaveBeenCalled()
  })

  it('counts a run that wrote entries from another device', async () => {
    const remote = {
      kind: 'ok',
      body: {
        acceptedIds: [],
        changes: [
          {
            schemaVersion: 1,
            id: '00000000-0000-4000-8000-000000000042',
            level: 'easy',
            source: 'generated',
            result: 'won',
            seed: null,
            playedMs: 1,
            mistakes: 0,
            hintsUsed: 0,
            finishedAt: '2026-10-14T09:00:00.000Z',
            createdAt: '2026-10-14T09:00:00.000Z',
            updatedAt: '2026-10-14T09:00:00.000Z',
            deletedAt: null,
          },
        ],
        cursor: 'c',
        more: false,
      },
    } satisfies SyncApiResult
    const { service } = serviceWith(scriptedApi([remote]).api)
    service.setSession(sessionOf(ALICE))
    await service.trigger('foreground')
    expect(service.status().revision).toBe(1)
  })

  it('starts the status from the time of the last run of the owner', async () => {
    await storage.sync.saveSyncedAt(ALICE, '2026-10-14T08:00:00.000Z')
    const { service } = serviceWith(scriptedApi([OK]).api)
    service.setSession(sessionOf(ALICE))
    await flush()
    expect(service.status().lastSyncedAt).toBe('2026-10-14T08:00:00.000Z')
    service.setSession(sessionOf(BOB))
    await flush()
    expect(service.status().lastSyncedAt).toBeNull()
  })

  it('skips a game-end trigger when nothing waits', async () => {
    const { api, requests } = scriptedApi([OK])
    const { service } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('game-end')).resolves.toBe('ignored')
    expect(requests).toHaveLength(0)
    await finishGame(storage, ALICE)
    await expect(service.trigger('game-end')).resolves.toBe('synced')
    expect(requests).toHaveLength(1)
  })
})

describe('single-flight', () => {
  it('runs one request for two triggers, and one more run for a burst during the run', async () => {
    const gate = gatedApi()
    const { service } = serviceWith(gate.api)
    service.setSession(sessionOf(ALICE))
    const first = service.trigger('foreground')
    await flush()
    const second = service.trigger('foreground')
    const third = service.trigger('network')
    const fourth = service.trigger('foreground')
    await flush()
    expect(gate.waiting).toHaveLength(1)
    gate.release()
    await flush()
    expect(gate.waiting).toHaveLength(1)
    gate.release()
    await expect(Promise.all([first, second, third, fourth])).resolves.toEqual(['synced', 'synced', 'synced', 'synced'])
    expect(gate.waiting).toHaveLength(0)
  })

  it('runs again for the new owner after the old run stops', async () => {
    const gate = gatedApi()
    const { service } = serviceWith(gate.api)
    service.setSession(sessionOf(ALICE))
    const first = service.trigger('foreground')
    await flush()
    service.setSession(sessionOf(BOB))
    const second = service.trigger('sign-in')
    await flush()
    gate.release()
    await flush()
    expect(gate.waiting).toHaveLength(1)
    gate.release()
    await expect(Promise.all([first, second])).resolves.toEqual(['synced', 'synced'])
  })

  it('stops a running run when the session ends', async () => {
    const gate = gatedApi()
    const { service } = serviceWith(gate.api)
    service.setSession(sessionOf(ALICE))
    const run = service.trigger('foreground')
    await flush()
    service.setSession(null)
    gate.release()
    await expect(run).resolves.toBe('stopped')
    await flush()
    expect(gate.waiting).toHaveLength(0)
  })
})

describe('backoff', () => {
  it('ignores a trigger during the wait and doubles the wait after each failure', async () => {
    const { api, requests } = scriptedApi([FAIL, FAIL, FAIL, OK])
    const { service } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('foreground')).resolves.toBe('failed')
    clock += 29_000
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    clock += 1_000
    await expect(service.trigger('foreground')).resolves.toBe('failed')
    clock += 59_000
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    clock += 1_000
    await expect(service.trigger('foreground')).resolves.toBe('failed')
    clock += 119_000
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    clock += 1_000
    await expect(service.trigger('foreground')).resolves.toBe('synced')
    expect(requests).toHaveLength(4)
    await expect(service.trigger('foreground')).resolves.toBe('synced')
  })

  it('caps the wait at 15 minutes', async () => {
    const { api } = scriptedApi([FAIL])
    const { service } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    for (let failure = 0; failure < 10; failure += 1) {
      clock += 15 * 60_000
      // oxlint-disable-next-line no-await-in-loop -- each trigger depends on the wait of the one before.
      await expect(service.trigger('foreground')).resolves.toBe('failed')
    }
    clock += 15 * 60_000 - 1
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    clock += 1
    await expect(service.trigger('foreground')).resolves.toBe('failed')
  })

  it('lets the network and the sign-in bypass the wait', async () => {
    const { api, requests } = scriptedApi([FAIL, OK])
    const { service } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    await service.trigger('foreground')
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    await expect(service.trigger('network')).resolves.toBe('synced')
    expect(requests).toHaveLength(2)
  })

  it('waits for the Retry-After of a 429 when it is longer', async () => {
    const { api } = scriptedApi([{ kind: 'throttled', retryAfterMs: 120_000 }, OK])
    const { service } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    await service.trigger('foreground')
    clock += 119_000
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    clock += 1_000
    await expect(service.trigger('foreground')).resolves.toBe('synced')
  })

  it('does not retry on a timer', async () => {
    jest.useFakeTimers()
    try {
      const { api, requests } = scriptedApi([FAIL, OK])
      const { service } = serviceWith(api)
      service.setSession(sessionOf(ALICE))
      await service.trigger('foreground')
      await jest.advanceTimersByTimeAsync(60 * 60_000)
      expect(requests).toHaveLength(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('does not count a run without a token as a failure', async () => {
    const { api } = scriptedApi([OK])
    const { service } = serviceWith(api)
    let token: string | null = null
    service.setSession({ owner: ALICE, getToken: async () => token, isCurrent: () => true })
    await expect(service.trigger('foreground')).resolves.toBe('skipped')
    token = ALICE
    await expect(service.trigger('foreground')).resolves.toBe('synced')
  })
})

describe('a failure inside the run', () => {
  it('never reaches the caller', async () => {
    const { service } = serviceWith(fakeServer().api)
    jest.spyOn(storage.history, 'pending').mockRejectedValue(new Error('disk full'))
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('foreground')).resolves.toBe('failed')
  })
})

describe('a deleted account', () => {
  it('calls onAccountDeleted once and stays stopped', async () => {
    const { api, requests } = scriptedApi([{ kind: 'account_deleted' }, OK])
    const { service, onAccountDeleted } = serviceWith(api)
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('sign-in')).resolves.toBe('deleted')
    expect(onAccountDeleted).toHaveBeenCalledTimes(1)
    expect(onAccountDeleted).toHaveBeenCalledWith(ALICE)
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('network')).resolves.toBe('ignored')
    expect(requests).toHaveLength(1)
    expect(service.status().lastSyncedAt).toBeNull()
  })

  it('still stops when onAccountDeleted fails', async () => {
    const { api } = scriptedApi([{ kind: 'account_deleted' }])
    const { service } = serviceWith(
      api,
      jest.fn(async () => {
        throw new Error('Clerk is gone')
      }),
    )
    service.setSession(sessionOf(ALICE))
    await expect(service.trigger('sign-in')).resolves.toBe('deleted')
    await expect(service.trigger('network')).resolves.toBe('ignored')
  })
})
