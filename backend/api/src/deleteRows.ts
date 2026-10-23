import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { sleep, type SyncDeps } from './deps'
import { SCAN_PREFIX, photoKey, userPk } from './tableDesign'

type Key = { pk: string; sk: string }

type DeleteDeps = Pick<SyncDeps, 'db' | 'tableName' | 'sleep' | 'photos'>

// The limit of one BatchWriteItem call.
const BATCH_SIZE = 25
// At most 4 batches run at once, to stay inside the write capacity.
const PARALLEL_BATCHES = 4
const PARALLEL_PHOTO_DELETES = 16
const MAX_ATTEMPTS = 5
const RETRY_BASE_MS = 50
// The second pass removes a row that a sync wrote just before the tombstone.
const MAX_PASSES = 2

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// Runs `run` for each item, `size` items at a time. A group finishes before the next one starts.
export async function inBatches<T>(
  items: readonly T[],
  size: number,
  run: (item: T) => Promise<unknown>,
): Promise<void> {
  for (const group of chunk(items, size)) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A group finishes before the next one starts, so the load stays bounded.
    await Promise.all(group.map(run))
  }
}

// Deletes every row of the player. Returns the number of rows. Every step is safe to repeat.
export async function deleteRows(deps: DeleteDeps, userId: string): Promise<number> {
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
async function deletePass(deps: DeleteDeps, userId: string): Promise<number> {
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
    // oxlint-disable-next-line eslint/no-await-in-loop -- The rows of this page go before the next page is read.
    await inBatches(chunk(keys, BATCH_SIZE), PARALLEL_BATCHES, (batch) => deleteBatch(deps, batch))
    total += keys.length
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return total
}

async function deleteBatch(deps: DeleteDeps, keys: Key[]): Promise<void> {
  let pending: Record<string, { DeleteRequest: { Key: Key } }[]> = {
    [deps.tableName]: keys.map((Key) => ({ DeleteRequest: { Key } })),
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A retry waits before it sends again.
    if (attempt > 0) await (deps.sleep ?? sleep)(RETRY_BASE_MS * 2 ** (attempt - 1))
    // oxlint-disable-next-line eslint/no-await-in-loop -- A retry must wait for the result of the attempt before it.
    const result = await deps.db.send(new BatchWriteCommand({ RequestItems: pending }))
    const left = result.UnprocessedItems?.[deps.tableName]
    if (!left || left.length === 0) return
    pending = { [deps.tableName]: left as { DeleteRequest: { Key: Key } }[] }
  }
  throw new Error('DynamoDB left items unprocessed.')
}

async function deletePhotos(deps: DeleteDeps, keys: Key[]): Promise<void> {
  const scanIds = keys.filter((key) => key.sk.startsWith(SCAN_PREFIX)).map((key) => key.sk.slice(SCAN_PREFIX.length))
  if (scanIds.length === 0) return
  if (!deps.photos) throw new Error('No photo store is linked.')
  const { photos } = deps
  await inBatches(scanIds, PARALLEL_PHOTO_DELETES, (id) => photos.delete(photoKey(id)))
}
