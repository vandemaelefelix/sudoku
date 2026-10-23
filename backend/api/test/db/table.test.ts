import { DescribeTableCommand, DescribeTimeToLiveCommand } from '@aws-sdk/client-dynamodb'
import { describe, expect, it } from 'vitest'
import { BY_SYNCED, TABLE } from '../../src/tableDesign'
import { suiteTable } from './harness'

describe('the test table', () => {
  const table = suiteTable()

  it('matches the table design of backend/infra/storage.ts', async () => {
    const { Table } = await table.client.send(new DescribeTableCommand({ TableName: table.tableName }))
    expect(Table?.KeySchema).toEqual([
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ])
    expect(Table?.BillingModeSummary?.BillingMode).toBe('PAY_PER_REQUEST')
    const index = Table?.LocalSecondaryIndexes?.find((i) => i.IndexName === BY_SYNCED)
    expect(index?.KeySchema).toEqual([
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'syncedAt', KeyType: 'RANGE' },
    ])
    expect(index?.Projection?.ProjectionType).toBe('ALL')
  })

  it('has the TTL attribute of the design', async () => {
    const { TimeToLiveDescription } = await table.client.send(
      new DescribeTimeToLiveCommand({ TableName: table.tableName }),
    )
    expect(TimeToLiveDescription?.AttributeName).toBe(TABLE.ttl)
  })
})
