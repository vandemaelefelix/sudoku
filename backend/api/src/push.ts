import { TransactionCanceledException, type CancellationReason } from '@aws-sdk/client-dynamodb'
import { TransactWriteCommand, type TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb'
import type { HistoryEntry } from '@sudoku/sync-contract'
import { DAILY_CAP, countExpiresAt, dayKey } from './dailyCount'
import { sleep, type SyncDeps } from './deps'
import { AccountDeleted } from './identity'
import { toGameItem } from './items'
import { countSk, identityKey, userPk } from './tableDesign'

export interface PushResult {
  // Request order, each id once.
  acceptedIds: string[]
  stored: number
  noop: number
  capped: number
  // Transaction attempts that met a TransactionConflict, retried or not.
  conflicts: number
}

export interface Owner {
  sub: string
  userId: string
}

type Outcome = 'stored' | 'noop' | 'capped' | 'conflict'

type PushDeps = Pick<SyncDeps, 'db' | 'tableName' | 'sleep'>

const CONFLICT_RETRIES = 2
// The jitter keeps two parallel requests of one player from meeting the same conflict again.
const CONFLICT_DELAY_MIN_MS = 20
const CONFLICT_DELAY_MAX_MS = 80

// The order of the transaction items. DynamoDB lists the CancellationReasons in the same order,
// so buildEntryTransaction and reasonsOf both read this one list.
const ITEM_ORDER = ['game', 'count', 'identity'] as const
type ItemName = (typeof ITEM_ORDER)[number]
type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number]

// ADR-028 decision 6 and ADR-027 decision 9. One transaction per entry writes the game row and the daily count
// together, so the count stays exact under parallel requests. The loop never stops at the cap: a no-op later in
// the request is still accepted.
export async function push(
  deps: PushDeps,
  owner: Owner,
  entries: readonly HistoryEntry[],
  now: Date,
): Promise<PushResult> {
  const result: PushResult = { acceptedIds: [], stored: 0, noop: 0, capped: 0, conflicts: 0 }
  const accepted = new Set<string>()
  for (const entry of entries) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- The cap stores entries in request order, so the writes run one by one.
    const outcome = await writeEntry(deps, owner, entry, now, result)
    if (outcome === 'stored') result.stored++
    if (outcome === 'noop') result.noop++
    if (outcome === 'capped') result.capped++
    if ((outcome === 'stored' || outcome === 'noop') && !accepted.has(entry.id)) {
      accepted.add(entry.id)
      result.acceptedIds.push(entry.id)
    }
  }
  return result
}

export function buildEntryTransaction(
  tableName: string,
  { sub, userId }: Owner,
  entry: HistoryEntry,
  now: Date,
): TransactWriteCommand {
  const items: Record<ItemName, TransactItem> = {
    game: {
      Put: {
        TableName: tableName,
        Item: toGameItem(userId, entry, now.toISOString()),
        // The contract allows only the form of Date.toISOString(), so a string compare orders updatedAt.
        ConditionExpression: 'attribute_not_exists(pk) OR #updatedAt < :updatedAt',
        ExpressionAttributeNames: { '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: { ':updatedAt': entry.updatedAt },
      },
    },
    count: {
      Update: {
        TableName: tableName,
        Key: { pk: userPk(userId), sk: countSk(dayKey(now)) },
        UpdateExpression: 'SET #expiresAt = if_not_exists(#expiresAt, :expiresAt) ADD #writes :one',
        ConditionExpression: 'attribute_not_exists(#writes) OR #writes < :cap',
        ExpressionAttributeNames: { '#writes': 'writes', '#expiresAt': 'expiresAt' },
        ExpressionAttributeValues: { ':one': 1, ':cap': DAILY_CAP, ':expiresAt': countExpiresAt(now) },
      },
    },
    identity: {
      // A delete that tombstones the identity after the read in sync() must stop this write (ADR-027 decision 10).
      ConditionCheck: {
        TableName: tableName,
        Key: identityKey(sub),
        ConditionExpression: 'attribute_not_exists(deletedAt)',
      },
    },
  }
  return new TransactWriteCommand({ TransactItems: ITEM_ORDER.map((name) => items[name]) })
}

async function writeEntry(
  deps: PushDeps,
  owner: Owner,
  entry: HistoryEntry,
  now: Date,
  result: PushResult,
): Promise<Outcome> {
  const command = buildEntryTransaction(deps.tableName, owner, entry, now)
  for (let attempt = 0; attempt <= CONFLICT_RETRIES; attempt++) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A retry must wait for the result of the attempt before it.
    const outcome = await tryTransaction(deps, command)
    if (outcome !== 'conflict') return outcome
    result.conflicts++
    if (attempt < CONFLICT_RETRIES) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- The delay comes before the next attempt.
      await (deps.sleep ?? sleep)(
        CONFLICT_DELAY_MIN_MS + Math.random() * (CONFLICT_DELAY_MAX_MS - CONFLICT_DELAY_MIN_MS),
      )
    }
  }
  // The entry stays on the waiting list of the phone. The next sync sends it again.
  return 'conflict'
}

function reasonsOf(error: TransactionCanceledException): Record<ItemName, CancellationReason | undefined> {
  const reasons = error.CancellationReasons ?? []
  return Object.fromEntries(ITEM_ORDER.map((name, index) => [name, reasons[index]])) as Record<
    ItemName,
    CancellationReason | undefined
  >
}

async function tryTransaction(deps: Pick<SyncDeps, 'db'>, command: TransactWriteCommand): Promise<Outcome> {
  try {
    await deps.db.send(command)
    return 'stored'
  } catch (error) {
    if (!(error instanceof TransactionCanceledException)) throw error
    const { game, count, identity } = reasonsOf(error)
    if (identity?.Code === 'ConditionalCheckFailed') throw new AccountDeleted()
    // The server holds an equal or newer updatedAt, so the id counts as accepted.
    if (game?.Code === 'ConditionalCheckFailed') return 'noop'
    if (count?.Code === 'ConditionalCheckFailed') return 'capped'
    if (game?.Code === 'TransactionConflict' || count?.Code === 'TransactionConflict') return 'conflict'
    throw error
  }
}
