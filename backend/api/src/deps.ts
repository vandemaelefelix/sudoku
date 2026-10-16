import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import type { ClerkClient } from './clerk'
import type { Logger } from './log'

// handler.ts builds these from the Lambda environment. The tests pass DynamoDB Local and a fixed clock.
export interface SyncDeps {
  db: DynamoDBDocumentClient
  tableName: string
  // Called once per request: every row of one request gets the same syncedAt.
  now: () => Date
  newUserId: () => string
  log: Logger
  // Waits before a retry of a conflicting write. The tests pass a stub. The default is setTimeout.
  sleep?: (ms: number) => Promise<void>
  // Rows per pull. 500 in production (ADR-028 decision 6).
  pageSize?: number
  // The Clerk Backend API. The tests pass a fake.
  clerk: ClerkClient
}
