import type { SyncRequest } from '@sudoku/sync-contract'
import type { GameStorage } from '@/storage'
import { BATCH_SIZE, MAX_ROUNDS } from './constants/sync.constants'
import { runSync } from './syncRun'
import { ALICE, BOB, createTestStorage, fakeServer, finishGame, noSleep, scriptedApi, uuid } from './syncTestKit'
import type { SyncApiResult, SyncSession } from './sync.types'
import { toWireEntry } from './wireEntry'
import type { SyncApi } from './syncApi'

let storage: GameStorage

beforeEach(() => {
  storage = createTestStorage()
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

function sessionOf(owner: string, overrides: Partial<SyncSession> = {}): SyncSession {
  return { owner, getToken: async () => owner, isCurrent: () => true, ...overrides }
}

function run(api: SyncApi, session = sessionOf(ALICE), history = storage.history) {
  return runSync({
    history,
    state: storage.sync,
    api,
    session,
    now: () => '2026-10-15T12:00:00.000Z',
    sleep: noSleep,
  })
}

const OK_API = () => scriptedApi([OK()]).api

const OK = (
  body: Partial<{ acceptedIds: string[]; changes: unknown[]; cursor: string; more: boolean }> = {},
): SyncApiResult => ({
  kind: 'ok',
  body: { acceptedIds: [], changes: [], cursor: 'next', more: false, ...body },
})

describe('push', () => {
  it('sends the waiting list and takes the accepted entries off it', async () => {
    const id = await finishGame(storage, ALICE)
    const server = fakeServer()
    await expect(run(server.api)).resolves.toMatchObject({ result: 'synced' })
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]?.entries).toMatchObject([{ id, schemaVersion: 1 }])
    await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
    await expect(storage.sync.syncedAt(ALICE)).resolves.toBe('2026-10-15T12:00:00.000Z')
  })

  it('marks only the accepted entries', async () => {
    const ids = [await finishGame(storage, ALICE), await finishGame(storage, ALICE), await finishGame(storage, ALICE)]
    const { api } = scriptedApi([OK({ acceptedIds: [ids[0]!, ids[2]!] })])
    await run(api)
    const left = await storage.history.pending(ALICE, 10)
    expect(left.map((record) => record.id)).toEqual([ids[1]])
  })

  it('ignores an accepted id that it did not send', async () => {
    const id = await finishGame(storage, ALICE)
    const { api } = scriptedApi([OK({ acceptedIds: [uuid(999)] })])
    await run(api)
    expect((await storage.history.pending(ALICE, 10)).map((record) => record.id)).toEqual([id])
  })

  it('keeps an entry that changed during the request on the waiting list', async () => {
    const id = await finishGame(storage, ALICE)
    const { api, requests } = scriptedApi([
      async () => {
        await storage.history.clear(ALICE)
        return OK({ acceptedIds: [id] })
      },
      OK(),
    ])
    await run(api)
    expect(requests[1]?.entries).toMatchObject([{ id, deletedAt: expect.any(String) }])
    const left = await storage.history.pending(ALICE, 10)
    expect(left).toMatchObject([{ id, deletedAt: expect.any(String) }])
  })

  it('sends 250 waiting entries in batches of 100, 100 and 50', async () => {
    for (let n = 0; n < 250; n += 1) {
      // oxlint-disable-next-line no-await-in-loop -- the clock and the ids count the calls in order.
      await finishGame(storage, ALICE)
    }
    const server = fakeServer()
    await expect(run(server.api)).resolves.toMatchObject({ result: 'synced' })
    expect(server.requests.map((request) => request.entries.length)).toEqual([100, 100, 50])
    await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
  })

  it('stops when the server accepts nothing, as at the daily cap', async () => {
    const ids = [await finishGame(storage, ALICE), await finishGame(storage, ALICE)]
    const server = fakeServer({ cap: 0 })
    await expect(run(server.api)).resolves.toMatchObject({ result: 'synced' })
    expect(server.requests).toHaveLength(1)
    expect((await storage.history.pending(ALICE, 10)).map((record) => record.id)).toEqual(ids)
  })

  it('goes on while the server takes part of the list', async () => {
    for (let n = 0; n < 5; n += 1) {
      // oxlint-disable-next-line no-await-in-loop -- the clock and the ids count the calls in order.
      await finishGame(storage, ALICE)
    }
    const server = fakeServer({ cap: 2 })
    await run(server.api)
    expect(server.requests.map((request) => request.entries.length)).toEqual([5, 3, 1])
    await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
  })

  it('leaves a local entry that breaks the contract out of the request', async () => {
    await finishGame(storage, ALICE)
    const records = await storage.history.pending(ALICE, 10)
    const broken = { ...records[0]!, id: 'not-a-uuid' }
    const history = { ...storage.history, pending: async () => [broken, ...records] }
    const server = fakeServer()
    await run(server.api, sessionOf(ALICE), history)
    expect(server.requests[0]?.entries.map((entry) => entry.id)).toEqual(records.map((record) => record.id))
  })
})

describe('pull', () => {
  it('stores the changes and saves the cursor', async () => {
    const remote = { ...toWireEntry({ ...(await remoteRecord(1)) }) }
    const { api } = scriptedApi([OK({ changes: [remote], cursor: 'c1' })])
    await expect(run(api)).resolves.toMatchObject({ result: 'synced', changed: true })
    await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: uuid(1) }])
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('c1')
  })

  it('does not call an echo of its own entry a change', async () => {
    await finishGame(storage, ALICE)
    await expect(run(fakeServer().api)).resolves.toMatchObject({ result: 'synced', changed: false })
  })

  it('reads every page while more is true and saves the cursor after each page', async () => {
    const server = fakeServer({ pageSize: 2 })
    server.stores.set(ALICE, await Promise.all([1, 2, 3, 4, 5].map(async (n) => toWireEntry(await remoteRecord(n)))))
    const saved = jest.spyOn(storage.sync, 'saveCursor')
    await expect(run(server.api)).resolves.toMatchObject({ result: 'synced', changed: true })
    expect(server.requests.map((request) => request.cursor)).toEqual([null, '2', '4'])
    expect(saved.mock.calls.map(([, cursor]) => cursor)).toEqual(['2', '4', '5'])
    await expect(storage.history.list(ALICE)).resolves.toHaveLength(5)
  })

  it('drops a change that breaks the contract, stores the rest and moves the cursor', async () => {
    const good = toWireEntry(await remoteRecord(1))
    const bad = { ...toWireEntry(await remoteRecord(2)), level: 'insane' }
    const { api } = scriptedApi([OK({ changes: [bad, good], cursor: 'c1' })])
    await run(api)
    await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: uuid(1) }])
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('c1')
  })

  it('stores the rest when the database refuses one entry', async () => {
    const good = toWireEntry(await remoteRecord(1))
    const refused = toWireEntry(await remoteRecord(2))
    const real = storage.history.upsertRemote.bind(storage.history)
    const history = {
      ...storage.history,
      upsertRemote: async (records: Parameters<typeof real>[0], owner: string) => {
        if (records.some((record) => record.id === refused.id)) throw new Error('CHECK constraint failed: played_ms')
        return real(records, owner)
      },
    }
    const { api } = scriptedApi([OK({ changes: [refused, good], cursor: 'c1' })])
    await expect(run(api, sessionOf(ALICE), history)).resolves.toMatchObject({ result: 'synced' })
    await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: uuid(1) }])
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('c1')
  })

  it('fails and keeps the cursor when the database fails for another reason', async () => {
    const history = {
      ...storage.history,
      upsertRemote: async () => {
        throw new Error('disk I/O error')
      },
    }
    const remote = toWireEntry(await remoteRecord(1))
    const { api } = scriptedApi([OK({ changes: [remote], cursor: 'c1' })])
    await expect(run(api, sessionOf(ALICE), history)).rejects.toThrow('disk I/O error')
    await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
  })

  it('clears the cursor on invalid_cursor and makes a full pull, once', async () => {
    await storage.sync.saveCursor(ALICE, 'old')
    const { api, requests } = scriptedApi([{ kind: 'cursor_invalid' }, OK({ cursor: 'fresh' })])
    await expect(run(api)).resolves.toMatchObject({ result: 'synced' })
    expect(requests.map((request) => request.cursor)).toEqual(['old', null])
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('fresh')
    const again = scriptedApi([{ kind: 'cursor_invalid' }])
    await expect(run(again.api)).resolves.toMatchObject({ result: 'failed' })
    expect(again.requests).toHaveLength(2)
  })

  it('ends a run after the most rounds, so the next trigger can go on', async () => {
    const sleep = jest.fn(async () => undefined)
    const { api, requests } = scriptedApi([OK({ more: true, cursor: 'again' })])
    const outcome = await runSync({
      history: storage.history,
      state: storage.sync,
      api,
      session: sessionOf(ALICE),
      now: () => '2026-10-15T12:00:00.000Z',
      sleep,
    })
    expect(outcome).toMatchObject({ result: 'partial', retryAfterMs: null })
    expect(requests).toHaveLength(MAX_ROUNDS)
    expect(sleep).toHaveBeenCalledTimes(MAX_ROUNDS - 8)
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('again')
  })
})

describe('a session that ends late', () => {
  it('does not say synced when the session ends while the page is stored', async () => {
    let current = true
    const save = storage.sync.saveCursor.bind(storage.sync)
    jest.spyOn(storage.sync, 'saveCursor').mockImplementation(async (owner, cursor) => {
      await save(owner, cursor)
      current = false
    })
    const session = sessionOf(ALICE, { isCurrent: () => current })
    await expect(run(OK_API(), session)).resolves.toMatchObject({ result: 'stopped' })
  })

  it('gives the API the signal of the run', async () => {
    const controller = new AbortController()
    const seen: (AbortSignal | undefined)[] = []
    const api: SyncApi = {
      async sync(_request, _token, signal) {
        seen.push(signal)
        return OK()
      },
    }
    await runSync({
      history: storage.history,
      state: storage.sync,
      api,
      session: sessionOf(ALICE),
      now: () => '2026-10-15T12:00:00.000Z',
      sleep: noSleep,
      signal: controller.signal,
    })
    expect(seen).toEqual([controller.signal])
  })
})

describe('a 401', () => {
  it('retries once at once with a fresh token', async () => {
    const getToken = jest.fn(async (_options?: { fresh?: boolean }) => 'token')
    const { api, requests } = scriptedApi([{ kind: 'unauthorized' }, OK()])
    await expect(run(api, sessionOf(ALICE, { getToken }))).resolves.toMatchObject({ result: 'synced' })
    expect(requests).toHaveLength(2)
    expect(getToken.mock.calls.map(([options]) => options?.fresh === true)).toEqual([false, true])
  })

  it('fails after a second 401', async () => {
    const { api, requests } = scriptedApi([{ kind: 'unauthorized' }])
    await expect(run(api)).resolves.toMatchObject({ result: 'failed' })
    expect(requests).toHaveLength(2)
  })
})

describe('invalid entries at the head of the waiting list', () => {
  it('does not block the valid entries behind them', async () => {
    await finishGame(storage, ALICE)
    const [record] = await storage.history.pending(ALICE, 10)
    const broken = Array.from({ length: BATCH_SIZE + 5 }, (_, n) => ({ ...record!, id: `bad-${n}` }))
    const history = {
      ...storage.history,
      pending: async (_owner: string, limit: number) => [...broken, record!].slice(0, limit),
    }
    const server = fakeServer()
    await run(server.api, sessionOf(ALICE), history)
    expect(server.requests[0]?.entries.map((entry) => entry.id)).toEqual([record!.id])
  })
})

describe('failure', () => {
  it.each<SyncApiResult>([
    { kind: 'offline' },
    { kind: 'server_error' },
    { kind: 'throttled', retryAfterMs: null },
    { kind: 'unauthorized' },
    { kind: 'rejected' },
  ])('is silent and changes nothing for %j', async (answer) => {
    const id = await finishGame(storage, ALICE)
    await storage.sync.saveCursor(ALICE, 'keep')
    await expect(run(scriptedApi([answer]).api)).resolves.toMatchObject({ result: 'failed' })
    expect((await storage.history.pending(ALICE, 10)).map((record) => record.id)).toEqual([id])
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('keep')
    await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
  })

  it('gives the wait of a 429', async () => {
    const outcome = await run(scriptedApi([{ kind: 'throttled', retryAfterMs: 120_000 }]).api)
    expect(outcome).toEqual({ result: 'failed', changed: false, retryAfterMs: 120_000 })
  })

  it('reports a deleted account', async () => {
    await expect(run(scriptedApi([{ kind: 'account_deleted' }]).api)).resolves.toMatchObject({ result: 'deleted' })
  })

  it('skips the run without a token', async () => {
    const { api, requests } = scriptedApi([OK()])
    await expect(run(api, sessionOf(ALICE, { getToken: async () => null }))).resolves.toMatchObject({
      result: 'skipped',
    })
    expect(requests).toHaveLength(0)
  })
})

describe('the session ends', () => {
  it('stops before a request when the session is no longer current', async () => {
    const { api, requests } = scriptedApi([OK()])
    await expect(run(api, sessionOf(ALICE, { isCurrent: () => false }))).resolves.toMatchObject({ result: 'stopped' })
    expect(requests).toHaveLength(0)
  })

  it('writes nothing when the session ends during the request', async () => {
    let current = true
    const id = await finishGame(storage, ALICE)
    const remote = toWireEntry(await remoteRecord(1))
    const { api } = scriptedApi([
      () => {
        current = false
        return OK({ acceptedIds: [id], changes: [remote], cursor: 'c1' })
      },
    ])
    await expect(run(api, sessionOf(ALICE, { isCurrent: () => current }))).resolves.toMatchObject({ result: 'stopped' })
    await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
    await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id }])
  })
})

describe('two accounts', () => {
  it('starts the second account with no cursor and never pushes the entries of the first', async () => {
    const aliceId = await finishGame(storage, ALICE)
    const server = fakeServer()
    await run(server.api)
    await expect(storage.sync.cursor(ALICE)).resolves.not.toBeNull()

    const bobId = await finishGame(storage, BOB)
    await run(server.api, sessionOf(BOB))
    const bobRequest = server.requests.at(-1) as SyncRequest
    expect(bobRequest.cursor).toBeNull()
    expect(bobRequest.entries.map((entry) => entry.id)).toEqual([bobId])
    await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id: bobId }])
    await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: aliceId }])
    expect(server.stores.get(BOB)?.map((entry) => entry.id)).toEqual([bobId])
  })
})

async function remoteRecord(n: number) {
  const id = uuid(n)
  const at = `2026-10-14T09:00:0${n}.000Z`
  return {
    id,
    level: 'easy' as const,
    source: 'generated' as const,
    seed: null,
    result: 'won' as const,
    playedMs: 1000 * n,
    mistakes: 0,
    hintsUsed: 0,
    finishedAt: at,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  }
}
