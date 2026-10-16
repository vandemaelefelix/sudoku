import { randomUUID } from 'node:crypto'
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { TABLE } from '../../src/tableDesign'

const ATTRIBUTE_TYPE = { string: 'S', number: 'N', binary: 'B' } as const

// The same translation of TABLE as the SST Dynamo component, so the test table matches backend/infra/storage.ts.
export function createTableInput(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: Object.entries(TABLE.fields).map(([name, type]) => ({
      AttributeName: name,
      AttributeType: ATTRIBUTE_TYPE[type],
    })),
    KeySchema: [
      { AttributeName: TABLE.primaryIndex.hashKey, KeyType: 'HASH' },
      { AttributeName: TABLE.primaryIndex.rangeKey, KeyType: 'RANGE' },
    ],
    LocalSecondaryIndexes: Object.entries(TABLE.localIndexes).map(([name, index]) => ({
      IndexName: name,
      KeySchema: [
        { AttributeName: TABLE.primaryIndex.hashKey, KeyType: 'HASH' },
        { AttributeName: index.rangeKey, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    })),
    GlobalSecondaryIndexes: Object.entries(TABLE.globalIndexes).map(([name, index]) => ({
      IndexName: name,
      KeySchema: [
        { AttributeName: index.hashKey, KeyType: 'HASH' },
        { AttributeName: index.rangeKey, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    })),
  }
}

export function localClient(): DynamoDBClient {
  const endpoint = process.env.DYNAMODB_ENDPOINT
  if (!endpoint) throw new Error('DYNAMODB_ENDPOINT is not set. Run the DB tests with: just test-api')
  return new DynamoDBClient({
    endpoint,
    region: 'eu-west-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  })
}

export interface TestTable {
  client: DynamoDBClient
  db: DynamoDBDocumentClient
  tableName: string
  drop: () => Promise<void>
}

// A unique name per call: worktrees and test files share one DynamoDB Local container.
export async function createTestTable(): Promise<TestTable> {
  const client = localClient()
  const db = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } })
  const tableName = `sync-test-${randomUUID()}`
  await client.send(new CreateTableCommand(createTableInput(tableName)))
  await client.send(
    new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: { AttributeName: TABLE.ttl, Enabled: true },
    }),
  )
  return {
    client,
    db,
    tableName,
    drop: async () => {
      await client.send(new DeleteTableCommand({ TableName: tableName }))
      client.destroy()
    },
  }
}
