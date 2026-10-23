import { syncRequestSchema, type SyncResponse } from '@sudoku/sync-contract'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { assertCursorOwner, assertCursorRange, decodeCursor, encodeCursor } from './cursor'
import type { SyncDeps } from './deps'
import { json, parseJsonBody, refuse, subOf, unauthorized, type Response } from './http'
import { findOrCreateUserId } from './identity'
import type { LogFields } from './log'
import { pull } from './pull'
import { push } from './push'

// POST /v1/sync (ADR-028 decision 5). A step that refuses throws a Refusal, so the call stops before any write.
// Writes the counts for the log line into `fields`.
export async function sync(
  deps: SyncDeps,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  fields: LogFields,
): Promise<Response> {
  const sub = subOf(event)
  if (!sub) return unauthorized()

  const parsed = syncRequestSchema.safeParse(parseJsonBody(event))
  if (!parsed.success) return refuse('invalid_request')
  const request = parsed.data
  fields.received = request.entries.length

  const cursor = decodeCursor(request.cursor)
  const userId = await findOrCreateUserId(deps, sub)
  fields.userId = userId
  assertCursorOwner(cursor, userId)
  assertCursorRange(cursor)

  // Push before pull, so the response holds the own changes. One server time for the whole request.
  // A delete that tombstones the player after the identity read makes push refuse with account_deleted.
  const pushed = await push(deps, { sub, userId }, request.entries, deps.now())
  // The push is idempotent, so after an invalid_cursor refusal the phone sends its entries again with a valid cursor.
  const pulled = await pull(deps, userId, cursor)
  Object.assign(fields, {
    stored: pushed.stored,
    noop: pushed.noop,
    capped: pushed.capped,
    conflicts: pushed.conflicts,
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
