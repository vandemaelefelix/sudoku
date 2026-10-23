import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import type { ClerkClient } from './clerk'
import type { Logger } from './log'
import type { PhotoStore } from './scans/presign'

// handler.ts builds these from the Lambda environment. The tests pass DynamoDB Local and a fixed clock.
export interface SyncDeps {
  db: DynamoDBDocumentClient
  tableName: string
  // Called once per request: every row of one request gets the same syncedAt.
  now: () => Date
  newUserId: () => string
  log: Logger
  // Waits before a retry of a conflicting write. The tests pass a stub. The default is `sleep`.
  sleep?: (ms: number) => Promise<void>
  // Rows per pull. 500 in production (ADR-028 decision 6).
  pageSize?: number
  // The Clerk Backend API. The tests pass a fake.
  clerk: ClerkClient
  // The scan photos (ADR-030). Account delete removes the photo of each SCAN row. A stage without a bucket passes none.
  photos?: Pick<PhotoStore, 'delete'>
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Both Lambdas call this at module scope: a warm Lambda reuses the client and its connections.
export function docClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
}
