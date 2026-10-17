import { MAX_JPEG_BYTES, validateScanRecord } from '@sudoku/scan-contract'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import type { SyncDeps } from '../deps'
import { errorResponse, json, serverError, unauthorized, type Response } from '../http'
import { AccountDeleted, findOrCreateUserId } from '../identity'
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
export async function handleScan(deps: ScanDeps, event: APIGatewayProxyEventV2): Promise<Response> {
  const started = performance.now()
  const fields: LogFields = { requestId: event.requestContext.requestId, routeKey: event.requestContext.routeKey }
  let response: Response
  try {
    response = await scan(deps, event, fields)
  } catch (error) {
    // Only the name: a DynamoDB message can hold a key.
    fields.errorName = error instanceof Error ? error.name : 'Unknown'
    response = serverError()
  }
  deps.log({ ...fields, status: response.statusCode, durationMs: Math.round(performance.now() - started) })
  return response
}

async function scan(deps: ScanDeps, event: APIGatewayProxyEventV2, fields: LogFields): Promise<Response> {
  if (!hasAppKey(event.headers['x-app-key'], deps.appKey)) return unauthorized()

  const record = parse(event)
  if (!record) {
    fields.code = 'invalid_request'
    return errorResponse('invalid_request')
  }

  // S3 enforces the size: the signed Content-Length must match the PUT.
  const bytes = parseJpegBytes(event.headers['x-jpeg-bytes'])
  if (bytes === undefined) {
    fields.code = 'invalid_request'
    return errorResponse('invalid_request')
  }

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
    try {
      userId = await findOrCreateUserId(deps, sub)
    } catch (error) {
      if (error instanceof AccountDeleted) {
        fields.code = 'account_deleted'
        return errorResponse('account_deleted')
      }
      throw error
    }
    fields.userId = userId
  }

  await putScan(deps, record, userId)
  return json(200, { uploadUrl: await deps.presignPut(photoKey(record.scanId), bytes) })
}

function parse(event: APIGatewayProxyEventV2) {
  if (!event.body) return undefined
  let input: unknown
  try {
    const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
    input = JSON.parse(text)
  } catch {
    return undefined
  }
  const result = validateScanRecord(input)
  return result.ok ? result.record : undefined
}

function parseJpegBytes(header: string | undefined): number | undefined {
  if (header === undefined || !/^\d+$/.test(header)) return undefined
  const bytes = Number(header)
  return bytes >= 1 && bytes <= MAX_JPEG_BYTES ? bytes : undefined
}
