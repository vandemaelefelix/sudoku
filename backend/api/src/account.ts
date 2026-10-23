import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { deleteRows } from './deleteRows'
import type { SyncDeps } from './deps'
import type { Response } from './http'
import { subOf, unauthorized } from './http'
import type { LogFields } from './log'
import { TOMBSTONE_DAYS, identityKey, ttlFrom } from './tableDesign'

// DELETE /v1/account (ADR-027 decision 10). The order is binding: the tombstone, the rows, the Clerk user.
// Every step is safe to repeat, so a failed call is retried whole while the Clerk session is valid.
// A Clerk failure leaves the player tombstoned: a sync answers 410 until a retry succeeds. Writes the row count for the log into `fields`.
export async function deleteAccount(
  deps: SyncDeps,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  fields: LogFields,
): Promise<Response> {
  const sub = subOf(event)
  if (!sub) return unauthorized()

  const userId = await writeTombstone(deps, sub)
  if (userId) {
    fields.userId = userId
    fields.deletedRows = await deleteRows(deps, userId)
  }
  await deps.clerk.deleteUser(sub)
  return { statusCode: 204 }
}

// One atomic update. It keeps userId and createdAt, because a retry needs the userId to find the rows.
// It keeps the first deletedAt and refreshes the TTL, so the tombstone outlives the last retry.
async function writeTombstone(deps: SyncDeps, sub: string): Promise<string | undefined> {
  const now = deps.now()
  const { Attributes } = await deps.db.send(
    new UpdateCommand({
      TableName: deps.tableName,
      Key: identityKey(sub),
      UpdateExpression: 'SET deletedAt = if_not_exists(deletedAt, :now), expiresAt = :ttl',
      ExpressionAttributeValues: { ':now': now.toISOString(), ':ttl': ttlFrom(now, TOMBSTONE_DAYS) },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return typeof Attributes?.userId === 'string' ? Attributes.userId : undefined
}
