import { MAX_JPEG_BYTES, validateScanRecord } from '@sudoku/scan-contract'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import type { SyncDeps } from '../deps'
import { json, observe, parseJsonBody, refuse, unauthorized, type Response } from '../http'
import { findOrCreateUserId } from '../identity'
import type { LogFields, Logger } from '../log'
import { photoKey } from '../tableDesign'
import { hasAppKey } from './appKey'
import { putScan } from './store'

export interface ScanDeps extends Pick<SyncDeps, 'db' | 'tableName' | 'now' | 'newUserId'> {
  log: Logger
  appKey: string
  // Throws for an invalid or expired token. Returns the sub.
  verifyToken: (token: string) => Promise<string>
  presignPut: (key: string, bytes: number) => Promise<string>
}

// POST /v1/scans (ADR-030). No JWT authorizer: the app key gates the call, and a token only adds the owner.
// A bad token answers 401, never a silent downgrade: the app retries once without the header.
export function handleScan(deps: ScanDeps, event: APIGatewayProxyEventV2): Promise<Response> {
  return observe(deps.log, event, (fields) => scan(deps, event, fields))
}

async function scan(deps: ScanDeps, event: APIGatewayProxyEventV2, fields: LogFields): Promise<Response> {
  if (!hasAppKey(event.headers['x-app-key'], deps.appKey)) return unauthorized()

  const validated = validateScanRecord(parseJsonBody(event))
  if (!validated.ok) return refuse('invalid_request')
  const { record } = validated

  // S3 enforces the size: the signed Content-Length must match the PUT.
  const bytes = parseJpegBytes(event.headers['x-jpeg-bytes'])
  if (bytes === undefined) return refuse('invalid_request')

  let userId: string | undefined
  const authorization = event.headers.authorization
  if (authorization !== undefined) {
    const token = /^Bearer (.+)$/i.exec(authorization)?.[1]
    if (!token) return unauthorized()
    let sub: string
    try {
      sub = await deps.verifyToken(token)
    } catch {
      return unauthorized()
    }
    // A deleted account refuses with account_deleted: the app then sends the scan again without the token.
    userId = await findOrCreateUserId(deps, sub)
    fields.userId = userId
  }

  await putScan(deps, record, userId)
  return json(200, { uploadUrl: await deps.presignPut(photoKey(record.scanId), bytes) })
}

function parseJpegBytes(header: string | undefined): number | undefined {
  if (header === undefined || !/^\d+$/.test(header)) return undefined
  const bytes = Number(header)
  return bytes >= 1 && bytes <= MAX_JPEG_BYTES ? bytes : undefined
}
