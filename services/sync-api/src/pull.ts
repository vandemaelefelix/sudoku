import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { MAX_CHANGES_PER_SYNC, type HistoryEntry } from '@sudoku/sync-contract'
import { InvalidCursor, nextCursor, readStart, type Cursor } from './cursor'
import type { SyncDeps } from './deps'
import { fromGameItem } from './items'
import { BY_SYNCED, userPk } from './tableDesign'

export interface PullResult {
  changes: HistoryEntry[]
  cursor: Cursor
  more: boolean
}

export async function pull(
  deps: Pick<SyncDeps, 'db' | 'tableName' | 'pageSize'>,
  userId: string,
  cursor: Cursor,
): Promise<PullResult> {
  const from = readStart(cursor.since)
  const { Items = [], LastEvaluatedKey } = await query(deps, userId, cursor, from)
  const rows = Items.map((item) => ({ syncedAt: String(item.syncedAt) }))
  return { changes: Items.map(fromGameItem), ...nextCursor(cursor, rows, LastEvaluatedKey) }
}

async function query(
  deps: Pick<SyncDeps, 'db' | 'tableName' | 'pageSize'>,
  userId: string,
  cursor: Cursor,
  from: string | null,
) {
  try {
    return await deps.db.send(
      new QueryCommand({
        TableName: deps.tableName,
        IndexName: BY_SYNCED,
        // A local index allows a consistent read, so the push of this request shows in the pull.
        ConsistentRead: true,
        KeyConditionExpression: from === null ? 'pk = :pk' : 'pk = :pk AND syncedAt >= :from',
        ExpressionAttributeValues: from === null ? { ':pk': userPk(userId) } : { ':pk': userPk(userId), ':from': from },
        ScanIndexForward: true,
        Limit: deps.pageSize ?? MAX_CHANGES_PER_SYNC,
        ExclusiveStartKey: cursor.after ?? undefined,
      }),
    )
  } catch (error) {
    // A hand-edited after that the range check let through. The key condition and the key do not fit.
    if (error instanceof Error && error.name === 'ValidationException') throw new InvalidCursor()
    throw error
  }
}
