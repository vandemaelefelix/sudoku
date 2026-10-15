import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FULL_PULL, InvalidCursor, type Cursor } from '../../src/cursor'
import { pull } from '../../src/pull'
import { countSk, identityKey, userPk } from '../../src/tableDesign'
import { createTestTable, type TestTable } from './table'
import { seedGames, times } from './seed'

let table: TestTable
let users = 0
const newUser = () => `pull-user-${++users}`
const deps = (pageSize = 500) => ({ db: table.db, tableName: table.tableName, pageSize })

beforeAll(async () => {
  table = await createTestTable()
})
afterAll(async () => {
  await table.drop()
})

describe('pull', () => {
  it('returns every game row for a null cursor, and no identity or count row', async () => {
    const userId = newUser()
    await seedGames(table, userId, times(3))
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { pk: userPk(userId), sk: countSk('2026-10-15'), writes: 3 },
      }),
    )
    await table.db.send(new PutCommand({ TableName: table.tableName, Item: { ...identityKey('sub'), userId } }))
    const result = await pull(deps(), userId, FULL_PULL)
    expect(result.changes).toHaveLength(3)
    expect(result.more).toBe(false)
    expect(result.cursor).toEqual({ v: 1, since: times(3).at(-1), after: null })
  })

  it('returns only the rows of the caller', async () => {
    const [mine, other] = [newUser(), newUser()]
    await seedGames(table, mine, times(2))
    await seedGames(table, other, times(4), 100)
    expect((await pull(deps(), mine, FULL_PULL)).changes).toHaveLength(2)
  })

  it('reads again the rows of the last 5 minutes before since, and not older ones', async () => {
    const userId = newUser()
    const since = '2026-10-15T10:00:00.000Z'
    await seedGames(table, userId, ['2026-10-15T09:54:00.000Z', '2026-10-15T09:56:00.000Z', since])
    const result = await pull(deps(), userId, { v: 1, since, after: null })
    expect(result.changes.map((c) => c.id)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ])
  })

  it('pages 1,200 rows as 500, 500 and 200, with the same since until the end', async () => {
    const userId = newUser()
    const synced = times(1200)
    await seedGames(table, userId, synced)
    const pages: { count: number; more: boolean; since: string | null }[] = []
    let cursor: Cursor = FULL_PULL
    for (let page = 0; page < 3; page++) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each page needs the cursor of the page before it.
      const result = await pull(deps(), userId, cursor)
      pages.push({ count: result.changes.length, more: result.more, since: result.cursor.since })
      cursor = result.cursor
    }
    expect(pages).toEqual([
      { count: 500, more: true, since: null },
      { count: 500, more: true, since: null },
      { count: 200, more: false, since: synced.at(-1) },
    ])
    expect(cursor.after).toBeNull()
  })

  it('ends an exact page of 500 with an empty page whose since comes from after', async () => {
    const userId = newUser()
    const synced = times(500)
    await seedGames(table, userId, synced)
    const first = await pull(deps(), userId, FULL_PULL)
    expect([first.changes.length, first.more]).toEqual([500, true])
    expect(first.cursor.after?.syncedAt).toBe(synced.at(-1))
    const second = await pull(deps(), userId, first.cursor)
    expect([second.changes.length, second.more]).toEqual([0, false])
    expect(second.cursor).toEqual({ v: 1, since: synced.at(-1), after: null })
  })

  it('throws InvalidCursor when DynamoDB refuses an after outside the query range', async () => {
    const userId = newUser()
    await seedGames(table, userId, times(2))
    const cursor: Cursor = {
      v: 1,
      since: '2026-10-15T10:00:00.000Z',
      after: { pk: userPk(userId), sk: 'GAME#x', syncedAt: '2026-10-15T08:00:00.000Z' },
    }
    await expect(pull(deps(), userId, cursor)).rejects.toBeInstanceOf(InvalidCursor)
  })
})
