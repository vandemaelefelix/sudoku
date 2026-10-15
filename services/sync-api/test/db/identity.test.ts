import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AccountDeleted, findOrCreateUserId } from '../../src/identity'
import { identityKey } from '../../src/tableDesign'
import { createTestTable, type TestTable } from './table'

const NOW = new Date('2026-10-15T09:00:00.000Z')

describe('findOrCreateUserId', () => {
  let table: TestTable
  let ids = 0
  const deps = () => ({
    db: table.db,
    tableName: table.tableName,
    now: () => NOW,
    newUserId: () => `user-${++ids}`,
  })

  beforeAll(async () => {
    table = await createTestTable()
  })
  afterAll(async () => {
    await table.drop()
  })

  it('creates one identity row for a new sub', async () => {
    const userId = await findOrCreateUserId(deps(), 'sub_new')
    const { Item } = await table.db.send(new GetCommand({ TableName: table.tableName, Key: identityKey('sub_new') }))
    expect(Item).toEqual({ ...identityKey('sub_new'), userId, createdAt: NOW.toISOString() })
  })

  it('reuses the user ID on a second request', async () => {
    const first = await findOrCreateUserId(deps(), 'sub_again')
    expect(await findOrCreateUserId(deps(), 'sub_again')).toBe(first)
  })

  it('gives one user ID to 5 parallel first requests', async () => {
    const userIds = await Promise.all(Array.from({ length: 5 }, () => findOrCreateUserId(deps(), 'sub_race')))
    expect(new Set(userIds).size).toBe(1)
    const { Items } = await table.db.send(
      new ScanCommand({
        TableName: table.tableName,
        FilterExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': identityKey('sub_race').pk },
      }),
    )
    expect(Items).toHaveLength(1)
  })

  it('throws AccountDeleted for a tombstone and creates no new user ID', async () => {
    const tombstone = {
      ...identityKey('sub_gone'),
      userId: 'old-user',
      createdAt: NOW.toISOString(),
      deletedAt: NOW.toISOString(),
      expiresAt: 1_800_000_000,
    }
    await table.db.send(new PutCommand({ TableName: table.tableName, Item: tombstone }))
    const before = ids
    await expect(findOrCreateUserId(deps(), 'sub_gone')).rejects.toThrow(AccountDeleted)
    expect(ids).toBe(before)
    const { Item } = await table.db.send(new GetCommand({ TableName: table.tableName, Key: identityKey('sub_gone') }))
    expect(Item).toEqual(tombstone)
  })
})
