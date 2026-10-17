import { BatchWriteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import type { SyncDeps } from './deps'
import type { Response } from './http'
import { unauthorized } from './http'
import type { LogFields } from './log'
import { SCAN_PREFIX, identityKey, photoKey, userPk } from './tableDesign'

const TOMBSTONE_TTL_SECONDS = 30 * 86_400
const BATCH_SIZE = 25
const PARALLEL_BATCHES = 4
const MAX_ATTEMPTS = 5
// The second pass removes a row that a sync wrote just before the tombstone.
const MAX_PASSES = 2

type Key = { pk: string; sk: string }

// DELETE /v1/account (ADR-027 decision 10). The order is binding: the tombstone, the rows, the Clerk user.
// Every step is safe to repeat, so a failed call is retried whole while the Clerk session is valid.
// A Clerk failure leaves the player tombstoned: a sync answers 410 until a retry succeeds. Writes the row count for the log into `fields`.
export async function deleteAccount(
  deps: SyncDeps,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  fields: LogFields,
): Promise<Response> {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub
  if (typeof sub !== 'string' || sub === '') return unauthorized()

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
      ExpressionAttributeValues: {
        ':now': now.toISOString(),
        ':ttl': Math.floor(now.getTime() / 1000) + TOMBSTONE_TTL_SECONDS,
      },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return typeof Attributes?.userId === 'string' ? Attributes.userId : undefined
}

async function deleteRows(deps: SyncDeps, userId: string): Promise<number> {
  let total = 0
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- The second pass must see the deletes of the first.
    const deleted = await deletePass(deps, userId)
    total += deleted
    if (deleted === 0) break
  }
  return total
}

// Reads the base table, not bySynced: one query returns the game rows and the daily count rows.
async function deletePass(deps: SyncDeps, userId: string): Promise<number> {
  let total = 0
  let startKey: Record<string, unknown> | undefined
  do {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each page needs the LastEvaluatedKey of the page before it.
    const page = await deps.db.send(
      new QueryCommand({
        TableName: deps.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': userPk(userId) },
        ProjectionExpression: 'pk, sk',
        ConsistentRead: true,
        ExclusiveStartKey: startKey,
      }),
    )
    const keys = (page.Items ?? []) as Key[]
    // The photo goes first: a failed photo delete leaves the row, so a retry still finds the scan.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each page of the query is handled before the next.
    await deletePhotos(deps, keys)
    const batches: Key[][] = []
    for (let i = 0; i < keys.length; i += BATCH_SIZE) batches.push(keys.slice(i, i + BATCH_SIZE))
    for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- At most 4 batches run at once, to stay inside the write capacity.
      await Promise.all(batches.slice(i, i + PARALLEL_BATCHES).map((batch) => deleteBatch(deps, batch)))
    }
    total += keys.length
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return total
}

async function deleteBatch(deps: SyncDeps, keys: Key[]): Promise<void> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  let pending: Record<string, { DeleteRequest: { Key: Key } }[]> = {
    [deps.tableName]: keys.map((Key) => ({ DeleteRequest: { Key } })),
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A retry waits before it sends again.
    if (attempt > 0) await sleep(50 * 2 ** (attempt - 1))
    // oxlint-disable-next-line eslint/no-await-in-loop -- A retry must wait for the result of the attempt before it.
    const result = await deps.db.send(new BatchWriteCommand({ RequestItems: pending }))
    const left = result.UnprocessedItems?.[deps.tableName]
    if (!left || left.length === 0) return
    pending = { [deps.tableName]: left as { DeleteRequest: { Key: Key } }[] }
  }
  throw new Error('DynamoDB left items unprocessed.')
}

async function deletePhotos(deps: SyncDeps, keys: Key[]): Promise<void> {
  const scanIds = keys.filter((key) => key.sk.startsWith(SCAN_PREFIX)).map((key) => key.sk.slice(SCAN_PREFIX.length))
  if (scanIds.length === 0) return
  if (!deps.photos) throw new Error('No photo store is linked.')
  const { photos } = deps
  for (let i = 0; i < scanIds.length; i += PARALLEL_BATCHES * 4) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- At most 16 deletes run at once.
    await Promise.all(scanIds.slice(i, i + PARALLEL_BATCHES * 4).map((id) => photos.delete(photoKey(id))))
  }
}
