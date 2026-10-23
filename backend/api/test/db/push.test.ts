import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it } from 'vitest'
import { countExpiresAt } from '../../src/dailyCount'
import { sleep } from '../../src/deps'
import { push } from '../../src/push'
import { countSk, gameSk, userPk } from '../../src/tableDesign'
import { entryWithId } from '../fixtures'
import { NOW, getItem, makeDeps, suiteTable } from './harness'

const LATER = new Date('2026-10-15T09:30:00.000Z')
const OLD = '2026-10-15T08:00:00.000Z'
const MID = '2026-10-15T08:30:00.000Z'
const NEW = '2026-10-15T08:45:00.000Z'

const table = suiteTable()
let users = 0
const newUser = () => `push-user-${++users}`
const owner = (userId: string) => ({ sub: `sub-of-${userId}`, userId })
// The real sleep: the parallel test needs a delay between two conflicting attempts.
const deps = () => makeDeps(table, { sleep })

const gameRow = (userId: string, id: string) => getItem(table, { pk: userPk(userId), sk: gameSk(id) })

async function writes(userId: string, now = NOW): Promise<number | undefined> {
  const Item = await getItem(table, { pk: userPk(userId), sk: countSk(now.toISOString().slice(0, 10)) })
  return Item?.writes as number | undefined
}

async function setCount(userId: string, value: number) {
  await table.db.send(
    new PutCommand({
      TableName: table.tableName,
      Item: { pk: userPk(userId), sk: countSk('2026-10-15'), writes: value, expiresAt: countExpiresAt(NOW) },
    }),
  )
}

describe('the write rule (ADR-028 decision 6)', () => {
  it('stores a new entry and stamps syncedAt with the server time', async () => {
    const userId = newUser()
    const entry = entryWithId(1, { updatedAt: MID })
    const result = await push(deps(), owner(userId), [entry], NOW)
    expect(result).toEqual({ acceptedIds: [entry.id], stored: 1, noop: 0, capped: 0, conflicts: 0 })
    expect(await gameRow(userId, entry.id)).toMatchObject({ updatedAt: MID, syncedAt: NOW.toISOString() })
    expect(await gameRow(userId, entry.id)).not.toHaveProperty('id')
  })

  it('accepts an older or equal updatedAt as a no-op: the row stays and nothing counts', async () => {
    const userId = newUser()
    await push(deps(), owner(userId), [entryWithId(1, { updatedAt: MID, mistakes: 1 })], NOW)
    const result = await push(
      deps(),
      owner(userId),
      [entryWithId(1, { updatedAt: OLD, mistakes: 7 }), entryWithId(1, { updatedAt: MID, mistakes: 8 })],
      LATER,
    )
    expect(result).toEqual({ acceptedIds: [entryWithId(1).id], stored: 0, noop: 2, capped: 0, conflicts: 0 })
    expect(await gameRow(userId, entryWithId(1).id)).toMatchObject({ mistakes: 1, syncedAt: NOW.toISOString() })
    expect(await writes(userId)).toBe(1)
  })

  it('overwrites with a newer updatedAt and a new syncedAt', async () => {
    const userId = newUser()
    await push(deps(), owner(userId), [entryWithId(1, { updatedAt: MID })], NOW)
    await push(deps(), owner(userId), [entryWithId(1, { updatedAt: NEW, mistakes: 5 })], LATER)
    expect(await gameRow(userId, entryWithId(1).id)).toMatchObject({ mistakes: 5, syncedAt: LATER.toISOString() })
  })

  it('stores a soft delete with a newer updatedAt', async () => {
    const userId = newUser()
    await push(deps(), owner(userId), [entryWithId(1, { updatedAt: MID })], NOW)
    await push(deps(), owner(userId), [entryWithId(1, { updatedAt: NEW, deletedAt: NEW })], LATER)
    expect(await gameRow(userId, entryWithId(1).id)).toMatchObject({ deletedAt: NEW, updatedAt: NEW })
  })

  it('gives the same accepted ids and the same count for the same request twice', async () => {
    const userId = newUser()
    const entries = [entryWithId(1), entryWithId(2), entryWithId(3)]
    const first = await push(deps(), owner(userId), entries, NOW)
    const second = await push(deps(), owner(userId), entries, LATER)
    expect(second.acceptedIds).toEqual(first.acceptedIds)
    expect(await writes(userId)).toBe(3)
  })

  it('keeps request order and lists an id once', async () => {
    const userId = newUser()
    const result = await push(
      deps(),
      owner(userId),
      [entryWithId(3), entryWithId(1), entryWithId(3), entryWithId(2)],
      NOW,
    )
    expect(result.acceptedIds).toEqual([entryWithId(3).id, entryWithId(1).id, entryWithId(2).id])
  })
})

describe('the daily count (ADR-027 decision 9)', () => {
  it('stores what fits under 200 in request order and leaves out the rest', async () => {
    const userId = newUser()
    await setCount(userId, 198)
    const entries = [1, 2, 3, 4, 5].map((n) => entryWithId(n))
    const result = await push(deps(), owner(userId), entries, NOW)
    expect(result).toEqual({
      acceptedIds: [entries[0]!.id, entries[1]!.id],
      stored: 2,
      noop: 0,
      capped: 3,
      conflicts: 0,
    })
    expect(await writes(userId)).toBe(200)
    expect(await gameRow(userId, entries[2]!.id)).toBeUndefined()
  })

  it('still accepts a no-op after the cap', async () => {
    const userId = newUser()
    await push(deps(), owner(userId), [entryWithId(1)], NOW)
    await setCount(userId, 200)
    const result = await push(deps(), owner(userId), [entryWithId(2), entryWithId(1)], NOW)
    expect(result).toEqual({ acceptedIds: [entryWithId(1).id], stored: 0, noop: 1, capped: 1, conflicts: 0 })
  })

  it('starts a new UTC day at 0, with a TTL of the day start plus 2 days', async () => {
    const userId = newUser()
    await setCount(userId, 200)
    const nextDay = new Date('2026-10-16T00:00:01.000Z')
    const result = await push(deps(), owner(userId), [entryWithId(1)], nextDay)
    expect(result.stored).toBe(1)
    const Item = await getItem(table, { pk: userPk(userId), sk: countSk('2026-10-16') })
    expect(Item).toMatchObject({ writes: 1, expiresAt: countExpiresAt(nextDay) })
    expect(Item).not.toHaveProperty('syncedAt')
  })

  it('never passes 200 with two parallel requests', async () => {
    const userId = newUser()
    await setCount(userId, 195)
    const [a, b] = await Promise.all([
      push(
        deps(),
        owner(userId),
        [1, 2, 3, 4, 5].map((n) => entryWithId(n)),
        NOW,
      ),
      push(
        deps(),
        owner(userId),
        [6, 7, 8, 9, 10].map((n) => entryWithId(n)),
        NOW,
      ),
    ])
    // A transaction conflict can leave an entry out after its retries, so the exact total is not fixed.
    const count = await writes(userId)
    expect(count).toBeLessThanOrEqual(200)
    expect(a.stored + b.stored).toBe(count! - 195)
  })
})
