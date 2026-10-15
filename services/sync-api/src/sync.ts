import { syncRequestSchema, type SyncRequest, type SyncResponse } from '@sudoku/sync-contract'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { InvalidCursor, assertCursorOwner, decodeCursor, encodeCursor, type Cursor } from './cursor'
import type { SyncDeps } from './deps'
import { errorResponse, json, unauthorized, type Response } from './http'
import { AccountDeleted, findOrCreateUserId } from './identity'
import type { LogFields } from './log'
import { pull } from './pull'
import { push } from './push'

// POST /v1/sync (ADR-028 decision 5). A step that refuses stops the call before any write.
// Writes the counts for the log line into `fields`.
export async function sync(
  deps: SyncDeps,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  fields: LogFields,
): Promise<Response> {
  // ADR-027 decision 4: the player comes only from the token, never from the path or the body.
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub
  if (typeof sub !== 'string' || sub === '') return unauthorized()

  const request = parseRequest(event)
  if (!request) return refuse(fields, 'invalid_request')
  fields.received = request.entries.length

  let cursor: Cursor
  try {
    cursor = decodeCursor(request.cursor)
  } catch (error) {
    if (error instanceof InvalidCursor) return refuse(fields, 'invalid_cursor')
    throw error
  }

  let userId: string
  try {
    userId = await findOrCreateUserId(deps, sub)
  } catch (error) {
    if (error instanceof AccountDeleted) return refuse(fields, 'account_deleted')
    throw error
  }
  fields.userId = userId

  try {
    assertCursorOwner(cursor, userId)
  } catch (error) {
    if (error instanceof InvalidCursor) return refuse(fields, 'invalid_cursor')
    throw error
  }

  // Push before pull, so the response holds the own changes. One server time for the whole request.
  const pushed = await push(deps, userId, request.entries, deps.now())
  const pulled = await pull(deps, userId, cursor)
  Object.assign(fields, {
    stored: pushed.stored,
    noop: pushed.noop,
    capped: pushed.capped,
    changes: pulled.changes.length,
    more: pulled.more,
  })
  const body: SyncResponse = {
    acceptedIds: pushed.acceptedIds,
    changes: pulled.changes,
    cursor: encodeCursor(pulled.cursor),
    more: pulled.more,
  }
  return json(200, body)
}

function parseRequest(event: APIGatewayProxyEventV2WithJWTAuthorizer): SyncRequest | null {
  const text = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = syncRequestSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function refuse(fields: LogFields, code: Parameters<typeof errorResponse>[0]): Response {
  fields.code = code
  return errorResponse(code)
}
