import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { GetCommand, PutCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { errorBodySchema, syncResponseSchema, type HistoryEntry } from '@sudoku/sync-contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeCursor } from '../../src/cursor'
import { findOrCreateUserId } from '../../src/identity'
import type { SyncDeps } from '../../src/deps'
import type { LogFields } from '../../src/log'
import { logLine } from '../../src/log'
import { route } from '../../src/route'
import { countSk, identityKey, userPk } from '../../src/tableDesign'
import { dayKey } from '../../src/dailyCount'
import { entryWithId, validEntry } from '../fixtures'
import { syncEvent } from './event'
import { createTestTable, type TestTable } from './table'

const NOW = new Date('2026-10-15T09:00:00.000Z')

let table: TestTable
let subs = 0
let lines: LogFields[] = []
const newSub = () => `user_sync_${++subs}`

function deps(): SyncDeps {
  let ids = 0
  return {
    db: table.db,
    tableName: table.tableName,
    now: () => NOW,
    newUserId: () => `id-${subs}-${++ids}`,
    log: (fields) => lines.push(fields),
  }
}

async function call(body: unknown, options: Parameters<typeof syncEvent>[1] = {}) {
  const response = await route(deps(), syncEvent(body, options))
  return { status: response.statusCode, body: JSON.parse(String(response.body)) as Record<string, unknown> }
}

async function gameRowCount(): Promise<number> {
  const { Items = [] } = await table.db.send(
    new ScanCommand({
      TableName: table.tableName,
      FilterExpression: 'begins_with(sk, :g)',
      ExpressionAttributeValues: { ':g': 'GAME#' },
    }),
  )
  return Items.length
}

beforeAll(async () => {
  table = await createTestTable()
})
afterAll(async () => {
  await table.drop()
})

describe('POST /v1/sync', () => {
  it('pushes, then pulls: the response holds the own changes and a cursor string', async () => {
    const entry = validEntry()
    const { status, body } = await call({ entries: [entry], cursor: null }, { sub: newSub() })
    expect(status).toBe(200)
    expect(syncResponseSchema.parse(body)).toEqual({
      acceptedIds: [entry.id],
      changes: [entry],
      cursor: encodeCursor({ v: 1, since: NOW.toISOString(), after: null }),
      more: false,
    })
  })

  it('sends a cursor string also for an empty full pull', async () => {
    const { body } = await call({ entries: [], cursor: null }, { sub: newSub() })
    expect(body).toEqual({
      acceptedIds: [],
      changes: [],
      cursor: encodeCursor({ v: 1, since: null, after: null }),
      more: false,
    })
  })

  it('reads a base64 body', async () => {
    const { status } = await call({ entries: [], cursor: null }, { sub: newSub(), base64: true })
    expect(status).toBe(200)
  })

  it('returns the entry again with the next cursor (the overlap), and stores nothing new', async () => {
    const sub = newSub()
    const entry = entryWithId(7)
    const first = await call({ entries: [entry], cursor: null }, { sub })
    const second = await call({ entries: [entry], cursor: first.body.cursor }, { sub })
    expect(second.body.acceptedIds).toEqual([entry.id])
    expect((second.body.changes as HistoryEntry[]).map((c) => c.id)).toEqual([entry.id])
  })
})

describe('the daily count at the route', () => {
  it('stores what fits, answers 200 and still pulls', async () => {
    const sub = newSub()
    await call({ entries: [entryWithId(0)], cursor: null }, { sub })
    const { Item } = await table.db.send(new GetCommand({ TableName: table.tableName, Key: identityKey(sub) }))
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { pk: userPk(String(Item?.userId)), sk: countSk(dayKey(NOW)), writes: 198 },
      }),
    )
    const entries = [1, 2, 3, 4, 5].map((n) => entryWithId(n))
    const { status, body } = await call({ entries, cursor: null }, { sub })
    expect(status).toBe(200)
    expect(body.acceptedIds).toEqual([entries[0]!.id, entries[1]!.id])
    expect(body.changes).toHaveLength(3)
  })
})

describe('refusals', () => {
  it('answers 401 without a sub claim', async () => {
    const { status, body } = await call({ entries: [], cursor: null }, { sub: null })
    expect(status).toBe(401)
    expect(body).toEqual({ message: 'Unauthorized' })
  })

  it.each([
    ['bad JSON', '{"entries": [', true],
    ['101 entries', { entries: Array.from({ length: 101 }, (_, n) => entryWithId(n)), cursor: null }, false],
    ['a bad UUID', { entries: [validEntry({ id: 'not-a-uuid' })], cursor: null }, false],
    ['schemaVersion 2', { entries: [{ ...validEntry(), schemaVersion: 2 }], cursor: null }, false],
  ])('answers 400 invalid_request for %s and writes no game row', async (_name, body, raw) => {
    const before = await gameRowCount()
    const response = await call(body, { sub: newSub(), raw })
    expect(response.status).toBe(400)
    expect(errorBodySchema.parse(response.body).code).toBe('invalid_request')
    expect(await gameRowCount()).toBe(before)
  })

  it('answers 400 invalid_cursor for an undecodable cursor and writes nothing', async () => {
    const before = await gameRowCount()
    const response = await call({ entries: [entryWithId(1)], cursor: 'not!base64' }, { sub: newSub() })
    expect(response.status).toBe(400)
    expect(errorBodySchema.parse(response.body).code).toBe('invalid_cursor')
    expect(await gameRowCount()).toBe(before)
  })

  it('answers 400 invalid_cursor for an after in another partition and writes nothing', async () => {
    const sub = newSub()
    await call({ entries: [], cursor: null }, { sub })
    const before = await gameRowCount()
    const cursor = encodeCursor({
      v: 1,
      since: null,
      after: { pk: 'USER#someone-else', sk: 'GAME#x', syncedAt: NOW.toISOString() },
    })
    const response = await call({ entries: [entryWithId(1)], cursor }, { sub })
    expect(response.status).toBe(400)
    expect(errorBodySchema.parse(response.body).code).toBe('invalid_cursor')
    expect(await gameRowCount()).toBe(before)
  })

  it('answers 400 invalid_cursor for an after before the start of the read and writes nothing', async () => {
    const sub = newSub()
    const userId = await findOrCreateUserId(deps(), sub)
    const before = await gameRowCount()
    const cursor = encodeCursor({
      v: 1,
      since: '2026-10-15T09:00:00.000Z',
      after: { pk: userPk(userId), sk: 'GAME#x', syncedAt: '2026-10-15T08:00:00.000Z' },
    })
    const response = await call({ entries: [entryWithId(1)], cursor }, { sub })
    expect(response.status).toBe(400)
    expect(errorBodySchema.parse(response.body).code).toBe('invalid_cursor')
    expect(await gameRowCount()).toBe(before)
  })

  it('answers 410 account_deleted for a tombstone, with no new identity row and no game row', async () => {
    const sub = newSub()
    const tombstone = {
      ...identityKey(sub),
      userId: 'gone',
      createdAt: NOW.toISOString(),
      deletedAt: NOW.toISOString(),
      expiresAt: 1,
    }
    await table.db.send(new PutCommand({ TableName: table.tableName, Item: tombstone }))
    const before = await gameRowCount()
    const response = await call({ entries: [entryWithId(1)], cursor: null }, { sub })
    expect(response.status).toBe(410)
    expect(errorBodySchema.parse(response.body).code).toBe('account_deleted')
    expect(await gameRowCount()).toBe(before)
    const { Item } = await table.db.send(new GetCommand({ TableName: table.tableName, Key: identityKey(sub) }))
    expect(Item).toEqual(tombstone)
  })

  it('answers 404 for an unknown route', async () => {
    const response = await call({}, { sub: newSub(), routeKey: 'GET /v1/other' })
    expect(response.status).toBe(404)
  })
})

describe('logging', () => {
  it('writes one line per request with no token, sub, email or Authorization', async () => {
    lines = []
    const sub = newSub()
    await call({ entries: [entryWithId(1), entryWithId(2)], cursor: null }, { sub })
    await call({ entries: [], cursor: null }, { sub: null })
    await call({ entries: [], cursor: 'bad!' }, { sub })
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ requestId: 'req-1', status: 200, received: 2, stored: 2, changes: 2, more: false })
    const text = lines.map(logLine).join('\n')
    for (const secret of [sub, 'secret-token', 'player@example.com', 'Bearer', 'uthorization']) {
      expect(text).not.toContain(secret)
    }
  })

  it('logs the count of transaction conflicts that a retry met', async () => {
    lines = []
    let conflicts = 1
    const db = {
      send: (command: unknown) => {
        if (command instanceof TransactWriteCommand && conflicts-- > 0) {
          throw new TransactionCanceledException({
            message: 'conflict',
            $metadata: {},
            CancellationReasons: [{ Code: 'TransactionConflict' }, { Code: 'None' }],
          })
        }
        return (table.db.send as (c: unknown) => unknown)(command)
      },
    } as unknown as SyncDeps['db']
    const waits: number[] = []
    const response = await route(
      { ...deps(), db, sleep: async (ms) => void waits.push(ms) },
      syncEvent({ entries: [entryWithId(1)], cursor: null }, { sub: newSub() }),
    )
    expect(response.statusCode).toBe(200)
    expect(lines[0]).toMatchObject({ stored: 1, conflicts: 1 })
    expect(waits).toHaveLength(1)
    expect(waits[0]).toBeGreaterThanOrEqual(20)
    expect(waits[0]).toBeLessThanOrEqual(80)
  })
})
