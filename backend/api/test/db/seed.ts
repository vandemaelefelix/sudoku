import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { toGameItem } from '../../src/items'
import { entryWithId } from '../fixtures'
import type { TestTable } from './table'

const BATCH = 25

// Writes game rows with the given syncedAt values straight to the table, without the push.
export async function seedGames(table: TestTable, userId: string, syncedAts: readonly string[], firstId = 0) {
  const items = syncedAts.map((syncedAt, n) => toGameItem(userId, entryWithId(firstId + n), syncedAt))
  const batches = []
  for (let start = 0; start < items.length; start += BATCH) {
    const requests = items.slice(start, start + BATCH).map((Item) => ({ PutRequest: { Item } }))
    batches.push(table.db.send(new BatchWriteCommand({ RequestItems: { [table.tableName]: requests } })))
  }
  await Promise.all(batches)
}

// n distinct syncedAt values, one millisecond apart, from start.
export function times(n: number, start = '2026-10-15T09:00:00.000Z'): string[] {
  const base = Date.parse(start)
  return Array.from({ length: n }, (_, i) => new Date(base + i).toISOString())
}
