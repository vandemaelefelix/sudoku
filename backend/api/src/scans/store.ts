import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { ScanRecord } from '@sudoku/scan-contract'
import type { SyncDeps } from '../deps'
import { SCAN_RETENTION_DAYS, contribPk, scanSk, ttlFrom, userPk } from '../tableDesign'

type StoreDeps = Pick<SyncDeps, 'db' | 'tableName' | 'now'>

// One row per scan. The conditional put makes a repeat of the same scanId a no-op (ADR-030).
// Returns false when the row already existed.
export async function putScan(deps: StoreDeps, record: ScanRecord, userId: string | undefined): Promise<boolean> {
  const now = deps.now()
  // A scan first sent without a token (the token expired) already has a CONTRIB row. Reuse it, so one scanId never has two rows.
  if (userId && (await contribRowExists(deps, record))) userId = undefined
  try {
    await deps.db.send(
      new PutCommand({
        TableName: deps.tableName,
        Item: {
          pk: userId ? userPk(userId) : contribPk(record.contributorId),
          sk: scanSk(record.scanId),
          ...record,
          ...(userId ? { userId } : {}),
          gsiPending: 'PENDING',
          createdAt: now.toISOString(),
          expiresAt: ttlFrom(now, SCAN_RETENTION_DAYS),
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    )
    return true
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false
    throw error
  }
}

async function contribRowExists(deps: StoreDeps, record: ScanRecord): Promise<boolean> {
  const { Item } = await deps.db.send(
    new GetCommand({
      TableName: deps.tableName,
      Key: { pk: contribPk(record.contributorId), sk: scanSk(record.scanId) },
      ConsistentRead: true,
    }),
  )
  return Item !== undefined
}
