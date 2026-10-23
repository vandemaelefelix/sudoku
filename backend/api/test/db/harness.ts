import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { afterAll, beforeAll } from 'vitest'
import type { SyncDeps } from '../../src/deps'
import { createTestTable, type TestTable } from './table'

export const NOW = new Date('2026-10-15T09:00:00.000Z')

let generatedIds = 0

// Creates one table for the describe block that calls it, and drops the table after the last test.
// The returned object reads the table at use time, because beforeAll has not run when the describe body runs.
export function suiteTable(): TestTable {
  let created: TestTable | undefined
  beforeAll(async () => {
    created = await createTestTable()
  })
  afterAll(async () => {
    await created?.drop()
  })
  const current = (): TestTable => {
    if (!created) throw new Error('The test table exists only inside a test or a hook.')
    return created
  }
  return {
    get client() {
      return current().client
    },
    get db() {
      return current().db
    },
    get tableName() {
      return current().tableName
    },
    drop: () => current().drop(),
  }
}

// The deps of a sync request with a fixed clock, no waits and a Clerk that does nothing. A test overrides what it checks.
export function makeDeps(table: TestTable, overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    db: table.db,
    tableName: table.tableName,
    now: () => NOW,
    newUserId: () => `generated-${++generatedIds}`,
    log: () => undefined,
    sleep: async () => undefined,
    clerk: { deleteUser: async () => undefined },
    ...overrides,
  }
}

export async function getItem(
  table: TestTable,
  key: { pk: string; sk: string },
): Promise<Record<string, unknown> | undefined> {
  const { Item } = await table.db.send(new GetCommand({ TableName: table.tableName, Key: key, ConsistentRead: true }))
  return Item
}

// Every row of one partition, or the rows of one index, or the one row of an exact sort key.
export async function queryPartition(
  table: TestTable,
  pk: string,
  options: { indexName?: string; sk?: string } = {},
): Promise<Record<string, unknown>[]> {
  const { Items } = await table.db.send(
    new QueryCommand({
      TableName: table.tableName,
      IndexName: options.indexName,
      KeyConditionExpression: options.sk === undefined ? 'pk = :pk' : 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: options.sk === undefined ? { ':pk': pk } : { ':pk': pk, ':sk': options.sk },
      ConsistentRead: true,
    }),
  )
  return Items ?? []
}
