import { randomUUID } from 'node:crypto'
import { S3Client } from '@aws-sdk/client-s3'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { createRemoteJWKSet } from 'jose'
import { Resource } from 'sst'
import { docClient } from '../deps'
import type { Response } from '../http'
import { consoleLogger } from '../log'
import { createPhotoStore } from './presign'
import { handleScan } from './scan'
import { createTokenVerifier } from './token'

// SST writes the Resource types only on a deploy, into a git-ignored file. This keeps the typecheck free of it.
const resource = Resource as unknown as {
  SyncTable: { name: string }
  ScansBucket: { name: string }
  ScanAppKey: { value: string }
}

// Module scope: a warm Lambda reuses the clients and the cached signing keys.
const db = docClient()
const photos = createPhotoStore(new S3Client({}), resource.ScansBucket.name)
const issuer = process.env.CLERK_ISSUER ?? ''
const verifyToken = createTokenVerifier({
  issuer,
  audience: process.env.CLERK_AUDIENCE ?? '',
  keys: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
})

export async function handler(event: APIGatewayProxyEventV2): Promise<Response> {
  return handleScan(
    {
      db,
      tableName: resource.SyncTable.name,
      now: () => new Date(),
      newUserId: randomUUID,
      log: consoleLogger,
      appKey: resource.ScanAppKey.value,
      verifyToken,
      presignPut: photos.presignPut,
    },
    event,
  )
}
