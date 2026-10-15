import { BatchWriteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SyncDeps } from '../../src/deps'
import { ClerkError } from '../../src/clerk'
import type { LogFields } from '../../src/log'
import { route } from '../../src/route'
import { countSk, identityKey, userPk } from '../../src/tableDesign'
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
  let sendWrap: ((db: SyncDeps['db']) => SyncDeps['db']) | undefined

  const deps = (): SyncDeps => ({
    db: sendWrap ? sendWrap(table.db) : table.db,
    tableName: table.tableName,
    now: () => NOW,
    newUserId: () => `user-${++n}`,
    log: (fields) => logged.push(fields),
    sleep: async () => undefined,
    clerk,
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
    sendWrap = undefined
    clerk = { deleteUser: async (sub) => void clerkCalls.push(sub) }
  }

  it('deletes the Clerk user, writes the tombstone and deletes every row', async () => {
    reset()
    await seedPlayer('sub_a', 'user-a', 60)
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
    expect(logged.at(-1)).toMatchObject({
      status: 204,
      userId: 'user-a',
      deletedRows: 61,
    })
  })

  it('calls Clerk first, while the identity row is still live and the rows exist', async () => {
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
    expect(seen).toEqual({ deletedAt: undefined, rows: 4 })
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

  it('answers 500 and changes nothing when Clerk fails, then succeeds on a retry', async () => {
    reset()
    await seedPlayer('sub_fail', 'user-fail', 3)
    clerk = {
      deleteUser: async () => {
        throw new ClerkError('Clerk answered 500.')
      },
    }
    expect((await del('sub_fail')).statusCode).toBe(500)
    expect((await identity('sub_fail'))?.deletedAt).toBeUndefined()
    expect(await rows('user-fail')).toHaveLength(4)
    expect(logged.at(-1)?.errorName).toBe('ClerkError')
    reset()
    expect((await del('sub_fail')).statusCode).toBe(204)
    expect(await rows('user-fail')).toEqual([])
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
    expect(clerkCalls).toEqual(['sub_rows'])
    expect((await identity('sub_rows'))?.userId).toBe('user-rows')
    expect((await identity('sub_rows'))?.deletedAt).toBeDefined()
    expect(await rows('user-rows')).toHaveLength(6)
    sendWrap = undefined
    expect((await del('sub_rows')).statusCode).toBe(204)
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
