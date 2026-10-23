import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it } from 'vitest'
import { AccountDeleted, findOrCreateUserId } from '../../src/identity'
import { identityKey } from '../../src/tableDesign'
import { NOW, getItem, makeDeps, suiteTable } from './harness'

describe('findOrCreateUserId', () => {
  const table = suiteTable()
  let ids = 0
  const deps = () => makeDeps(table, { newUserId: () => `user-${++ids}` })

  it('creates one identity row for a new sub', async () => {
    const userId = await findOrCreateUserId(deps(), 'sub_new')
    const Item = await getItem(table, identityKey('sub_new'))
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
    const Item = await getItem(table, identityKey('sub_gone'))
    expect(Item).toEqual(tombstone)
  })
})
