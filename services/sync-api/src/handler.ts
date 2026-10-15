import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { Resource } from 'sst'
import { createClerkClient } from './clerk'
import type { SyncDeps } from './deps'
import type { Response } from './http'
import { consoleLogger } from './log'
import { route } from './route'

// SST writes the Resource types only on a deploy, into a git-ignored file. This keeps the typecheck free of it.
const tableName = (Resource as unknown as { SyncTable: { name: string } }).SyncTable.name

const clerkSecret = () => (Resource as unknown as { ClerkSecretKey: { value: string } }).ClerkSecretKey.value

// Module scope: a warm Lambda reuses the client and its connections.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<Response> {
  const deps: SyncDeps = {
    db,
    tableName,
    now: () => new Date(),
    newUserId: randomUUID,
    log: consoleLogger,
    // Lazy: a sync never reads the secret.
    clerk: { deleteUser: (sub) => createClerkClient(clerkSecret()).deleteUser(sub) },
  }
  return route(deps, event)
}
