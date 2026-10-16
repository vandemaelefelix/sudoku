import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SyncDeps } from '../../src/deps'
import { ClerkError, lazyClerkClient } from '../../src/clerk'
import type { LogFields } from '../../src/log'
import { route } from '../../src/route'
import { BY_SYNCED, countSk, identityKey, userPk } from '../../src/tableDesign'
import { entryWithId } from '../fixtures'
import { syncEvent } from './event'
import { seedGames, times } from './seed'
import { createTestTable, type TestTable } from './table'

const NOW = new Date('2026-10-15T09:00:00.000Z')
const DAY = 86_400
const DELETE = 'DELETE /v1/account'

describe('DELETE /v1/account', () => {
  let table: TestTable
  let n = 0
  let clerkCalls: string[]
  let clerk: SyncDeps['clerk']
  let logged: LogFields[]
  let photoDeletes: string[]
  let photoFailure: boolean
  let sendWrap: ((db: SyncDeps['db']) => SyncDeps['db']) | undefined

  const deps = (): SyncDeps => ({
    db: sendWrap ? sendWrap(table.db) : table.db,
    tableName: table.tableName,
    now: () => NOW,
    newUserId: () => `user-${++n}`,
    log: (fields) => logged.push(fields),
    sleep: async () => undefined,
    clerk,
    photos: {
      delete: async (key) => {
        if (photoFailure) throw new Error('S3 down')
        photoDeletes.push(key)
      },
    },
  })
  const del = (sub: string) => route(deps(), syncEvent(null, { sub, routeKey: DELETE }))
  const sync = (sub: string) => route(deps(), syncEvent({ entries: [], cursor: null }, { sub }))
  const rows = async (userId: string) =>
    (
      await table.db.send(
        new QueryCommand({
          TableName: table.tableName,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': userPk(userId) },
          ConsistentRead: true,
        }),
      )
    ).Items ?? []
  const bySynced = async (userId: string) =>
    (
      await table.db.send(
        new QueryCommand({
          TableName: table.tableName,
          IndexName: BY_SYNCED,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': userPk(userId) },
        }),
      )
    ).Items ?? []
  const identity = async (sub: string) =>
    (
      await table.db.send(
        new GetCommand({
          TableName: table.tableName,
          Key: identityKey(sub),
          ConsistentRead: true,
        }),
      )
    ).Item
  const seedPlayer = async (sub: string, userId: string, games: number) => {
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { ...identityKey(sub), userId, createdAt: NOW.toISOString() },
      }),
    )
    await seedGames(table, userId, times(games))
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: {
          pk: userPk(userId),
          sk: countSk('2026-10-15'),
          count: 2,
          expiresAt: 1_900_000_000,
        },
      }),
    )
  }

  beforeAll(async () => {
    table = await createTestTable()
  })
  afterAll(async () => {
    await table.drop()
  })
  const reset = () => {
    clerkCalls = []
    logged = []
    photoDeletes = []
    photoFailure = false
    sendWrap = undefined
    clerk = { deleteUser: async (sub) => void clerkCalls.push(sub) }
  }

  it('deletes the Clerk user, writes the tombstone and deletes every row', async () => {
    reset()
    await seedPlayer('sub_a', 'user-a', 60)
    expect((await rows('user-a')).map((row) => row.sk)).toContain(countSk('2026-10-15'))
    expect(await bySynced('user-a')).toHaveLength(60)
    const response = await del('sub_a')
    expect(response.statusCode).toBe(204)
    expect(response.body ?? '').toBe('')
    expect(clerkCalls).toEqual(['sub_a'])
    expect(await identity('sub_a')).toEqual({
      ...identityKey('sub_a'),
      userId: 'user-a',
      createdAt: NOW.toISOString(),
      deletedAt: NOW.toISOString(),
      expiresAt: NOW.getTime() / 1000 + 30 * DAY,
    })
    expect(await rows('user-a')).toEqual([])
    expect(await bySynced('user-a')).toEqual([])
    expect(logged.at(-1)).toMatchObject({
      status: 204,
      userId: 'user-a',
      deletedRows: 61,
    })
  })

  it('calls Clerk last, after the tombstone and the row delete', async () => {
    reset()
    await seedPlayer('sub_order', 'user-order', 3)
    let seen: { deletedAt: unknown; rows: number } | undefined
    clerk = {
      deleteUser: async () => {
        seen = {
          deletedAt: (await identity('sub_order'))?.deletedAt,
          rows: (await rows('user-order')).length,
        }
      },
    }
    await del('sub_order')
    expect(seen).toEqual({ deletedAt: NOW.toISOString(), rows: 0 })
  })

  it('deletes a large history in pages', async () => {
    reset()
    await seedPlayer('sub_big', 'user-big', 1200)
    expect((await del('sub_big')).statusCode).toBe(204)
    expect(await rows('user-big')).toEqual([])
  })

  it('retries unprocessed items of a batch', async () => {
    reset()
    await seedPlayer('sub_unp', 'user-unp', 30)
    // Fake one unprocessed answer: the first batch call returns its requests as unprocessed and writes nothing.
    sendWrap = (db) => {
      let faked = false
      return new Proxy(db, {
        get(target, prop) {
          if (prop !== 'send') return Reflect.get(target, prop)
          return async (command: unknown) => {
            if (command instanceof BatchWriteCommand && !faked) {
              faked = true
              return {
                UnprocessedItems: command.input.RequestItems,
                $metadata: {},
              }
            }
            return target.send(command as never)
          }
        },
      })
    }
    expect((await del('sub_unp')).statusCode).toBe(204)
    expect(await rows('user-unp')).toEqual([])
  })

  it('writes a tombstone without a user ID when the player never synced', async () => {
    reset()
    expect((await del('sub_never')).statusCode).toBe(204)
    expect(await identity('sub_never')).toEqual({
      ...identityKey('sub_never'),
      deletedAt: NOW.toISOString(),
      expiresAt: NOW.getTime() / 1000 + 30 * DAY,
    })
    expect(logged.at(-1)?.userId).toBeUndefined()
  })

  it('succeeds a second time and keeps the first deletedAt', async () => {
    reset()
    await seedPlayer('sub_twice', 'user-twice', 2)
    await del('sub_twice')
    const later = new Date(NOW.getTime() + 5 * DAY * 1000)
    const response = await route(
      { ...deps(), now: () => later },
      syncEvent(null, { sub: 'sub_twice', routeKey: DELETE }),
    )
    expect(response.statusCode).toBe(204)
    const item = await identity('sub_twice')
    expect(item?.deletedAt).toBe(NOW.toISOString())
    expect(item?.userId).toBe('user-twice')
    expect(item?.expiresAt).toBe(later.getTime() / 1000 + 30 * DAY)
  })

  it('keeps the tombstone when Clerk fails, answers 410 to a sync, and a retry succeeds', async () => {
    reset()
    await seedPlayer('sub_fail', 'user-fail', 3)
    clerk = {
      deleteUser: async () => {
        throw new ClerkError('Clerk answered 500.')
      },
    }
    expect((await del('sub_fail')).statusCode).toBe(500)
    expect(logged.at(-1)?.errorName).toBe('ClerkError')
    expect((await identity('sub_fail'))?.deletedAt).toBe(NOW.toISOString())
    expect(await rows('user-fail')).toEqual([])
    expect((await sync('sub_fail')).statusCode).toBe(410)
    reset()
    expect((await del('sub_fail')).statusCode).toBe(204)
    expect(clerkCalls).toEqual(['sub_fail'])
  })

  it('writes nothing when the tombstone write fails, and a retry succeeds', async () => {
    reset()
    await seedPlayer('sub_tomb', 'user-tomb', 3)
    sendWrap = (db) =>
      new Proxy(db, {
        get(target, prop) {
          if (prop !== 'send') return Reflect.get(target, prop)
          return async (command: unknown) => {
            if (command instanceof UpdateCommand) throw new Error('boom')
            return target.send(command as never)
          }
        },
      })
    expect((await del('sub_tomb')).statusCode).toBe(500)
    expect(clerkCalls).toEqual([])
    expect((await identity('sub_tomb'))?.deletedAt).toBeUndefined()
    expect(await rows('user-tomb')).toHaveLength(4)
    sendWrap = undefined
    expect((await del('sub_tomb')).statusCode).toBe(204)
    expect(await rows('user-tomb')).toEqual([])
  })

  it('keeps the tombstone when the row delete fails, and a retry finishes', async () => {
    reset()
    await seedPlayer('sub_rows', 'user-rows', 5)
    sendWrap = (db) =>
      new Proxy(db, {
        get(target, prop) {
          if (prop !== 'send') return Reflect.get(target, prop)
          return async (command: unknown) => {
            if (command instanceof BatchWriteCommand) throw new Error('boom')
            return target.send(command as never)
          }
        },
      })
    expect((await del('sub_rows')).statusCode).toBe(500)
    expect(clerkCalls).toEqual([])
    expect((await identity('sub_rows'))?.userId).toBe('user-rows')
    expect((await identity('sub_rows'))?.deletedAt).toBeDefined()
    expect(await rows('user-rows')).toHaveLength(6)
    sendWrap = undefined
    expect((await del('sub_rows')).statusCode).toBe(204)
    expect(clerkCalls).toEqual(['sub_rows'])
    expect(await rows('user-rows')).toEqual([])
  })

  it('gives 410 to a sync after the delete and creates no identity row', async () => {
    reset()
    await seedPlayer('sub_sync', 'user-sync', 1)
    await del('sub_sync')
    const response = await sync('sub_sync')
    expect(response.statusCode).toBe(410)
    expect(JSON.parse(String(response.body)).code).toBe('account_deleted')
    const { Items } = await table.db.send(
      new ScanCommand({
        TableName: table.tableName,
        FilterExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': identityKey('sub_sync').pk },
      }),
    )
    expect(Items).toHaveLength(1)
  })

  it('writes no row when the tombstone lands between the identity read and the push', async () => {
    reset()
    await seedPlayer('sub_race', 'user-race', 0)
    sendWrap = (db) => {
      let tombstoned = false
      return new Proxy(db, {
        get(target, prop) {
          if (prop !== 'send') return Reflect.get(target, prop)
          return async (command: unknown) => {
            if (command instanceof TransactWriteCommand && !tombstoned) {
              tombstoned = true
              await target.send(
                new UpdateCommand({
                  TableName: table.tableName,
                  Key: identityKey('sub_race'),
                  UpdateExpression: 'SET deletedAt = :now',
                  ExpressionAttributeValues: { ':now': NOW.toISOString() },
                }),
              )
            }
            return target.send(command as never)
          }
        },
      })
    }
    const response = await route(deps(), syncEvent({ entries: [entryWithId(1)], cursor: null }, { sub: 'sub_race' }))
    expect(response.statusCode).toBe(410)
    expect(JSON.parse(String(response.body)).code).toBe('account_deleted')
    // Only the seeded count row stays: the push wrote no game row and did not raise the count.
    expect((await rows('user-race')).map((row) => [row.sk, row.count])).toEqual([[countSk('2026-10-15'), 2]])
  })

  it('answers 500 with errorName ClerkError on a stage without a Clerk secret', async () => {
    reset()
    await seedPlayer('sub_noclerk', 'user-noclerk', 1)
    clerk = lazyClerkClient(() => {
      throw new Error('ClerkSecretKey is not linked.')
    })
    expect((await del('sub_noclerk')).statusCode).toBe(500)
    expect(logged.at(-1)?.errorName).toBe('ClerkError')
  })

  it('deletes the photo of each SCAN row before the row', async () => {
    reset()
    await seedPlayer('sub_scan', 'user-scan', 1)
    const items = ['s-1', 's-2'].map((id) => ({
      pk: userPk('user-scan'),
      sk: `SCAN#${id}`,
      gsiPending: 'PENDING',
      createdAt: NOW.toISOString(),
    }))
    await Promise.all(items.map((Item) => table.db.send(new PutCommand({ TableName: table.tableName, Item }))))
    expect((await del('sub_scan')).statusCode).toBe(204)
    // oxlint-disable-next-line unicorn/no-array-sort -- The copy is sorted, and lib has no toSorted.
    expect([...photoDeletes].sort()).toEqual(['scans/s-1.jpg', 'scans/s-2.jpg'])
    expect(await rows('user-scan')).toEqual([])
  })

  it('keeps the SCAN row when the photo delete fails, so a retry finds it', async () => {
    reset()
    await seedPlayer('sub_scanfail', 'user-scanfail', 0)
    await table.db.send(
      new PutCommand({ TableName: table.tableName, Item: { pk: userPk('user-scanfail'), sk: 'SCAN#s-9' } }),
    )
    photoFailure = true
    expect((await del('sub_scanfail')).statusCode).toBe(500)
    expect((await rows('user-scanfail')).map((row) => row.sk)).toContain('SCAN#s-9')
    expect(clerkCalls).toEqual([])
    photoFailure = false
    expect((await del('sub_scanfail')).statusCode).toBe(204)
    expect(photoDeletes).toEqual(['scans/s-9.jpg'])
    expect(await rows('user-scanfail')).toEqual([])
  })

  it('leaves the rows of another player', async () => {
    reset()
    await seedPlayer('sub_x', 'user-x', 2)
    await seedPlayer('sub_y', 'user-y', 2)
    await del('sub_x')
    expect(await rows('user-y')).toHaveLength(3)
    expect((await identity('sub_y'))?.deletedAt).toBeUndefined()
  })

  it('writes no sub, token or key to the log', async () => {
    reset()
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await seedPlayer('sub_secret', 'user-secret', 1)
    await route(
      { ...deps(), log: (await import('../../src/log')).consoleLogger },
      syncEvent(null, { sub: 'sub_secret', routeKey: DELETE }),
    )
    const text = spy.mock.calls.flat().join('\n')
    spy.mockRestore()
    expect(text).toContain('user-secret')
    expect(text).not.toContain('sub_secret')
    expect(text).not.toContain('secret-token')
  })
})
