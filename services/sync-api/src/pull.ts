import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { MAX_CHANGES_PER_SYNC, type HistoryEntry } from '@sudoku/sync-contract'
import { nextCursor, type Cursor } from './cursor'
import type { SyncDeps } from './deps'
import { fromGameItem } from './items'
import { BY_SYNCED, userPk } from './tableDesign'

// A slow write from another device can land with a syncedAt just below the watermark (ADR-028 decision 6).
const OVERLAP_MS = 5 * 60 * 1000

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
  const from = cursor.since === null ? null : new Date(Date.parse(cursor.since) - OVERLAP_MS).toISOString()
  const { Items = [], LastEvaluatedKey } = await deps.db.send(
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
  const rows = Items.map((item) => ({ syncedAt: String(item.syncedAt) }))
  return { changes: Items.map(fromGameItem), ...nextCursor(cursor, rows, LastEvaluatedKey) }
}
