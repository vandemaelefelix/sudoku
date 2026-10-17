import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { Resource } from 'sst'
import { lazyClerkClient } from './clerk'
import type { SyncDeps } from './deps'
import type { Response } from './http'
import { consoleLogger } from './log'
import { route } from './route'
import { createPhotoStore } from './scans/presign'

// SST writes the Resource types only on a deploy, into a git-ignored file. This keeps the typecheck free of it.
const tableName = (Resource as unknown as { SyncTable: { name: string } }).SyncTable.name

const clerkSecret = () => (Resource as unknown as { ClerkSecretKey: { value: string } }).ClerkSecretKey.value

const bucketName = () => (Resource as unknown as { ScansBucket: { name: string } }).ScansBucket.name

// Module scope: a warm Lambda reuses the client and its connections.
const s3 = new S3Client({})
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<Response> {
  const deps: SyncDeps = {
    db,
    tableName,
    now: () => new Date(),
    newUserId: randomUUID,
    log: consoleLogger,
    // Lazy: a sync never reads the secret.
    clerk: lazyClerkClient(clerkSecret),
    // Lazy too: only the account delete reads the bucket name.
    photos: { delete: (key) => createPhotoStore(s3, bucketName()).delete(key) },
  }
  return route(deps, event)
}
