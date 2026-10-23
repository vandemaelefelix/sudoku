import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { SyncDeps } from './deps'
import { Refusal } from './http'
import { identityKey } from './tableDesign'

export class AccountDeleted extends Refusal {
  override name = 'AccountDeleted'
  constructor() {
    super('account_deleted')
  }
}

type IdentityDeps = Pick<SyncDeps, 'db' | 'tableName' | 'now' | 'newUserId'>

// ADR-027 decision 2. Throws AccountDeleted for a tombstone: the Lambda never gives a deleted sub a new user ID.
export async function findOrCreateUserId(deps: IdentityDeps, sub: string): Promise<string> {
  const found = await readIdentity(deps, sub)
  if (found) return found
  try {
    const userId = deps.newUserId()
    await deps.db.send(
      new PutCommand({
        TableName: deps.tableName,
        Item: { ...identityKey(sub), userId, createdAt: deps.now().toISOString() },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    )
    return userId
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error
  }
  // A parallel first request wrote the row between the read and the put.
  const winner = await readIdentity(deps, sub)
  if (!winner) throw new Error('The identity row vanished after a failed condition.')
  return winner
}

async function readIdentity(deps: IdentityDeps, sub: string): Promise<string | null> {
  const { Item } = await deps.db.send(
    new GetCommand({ TableName: deps.tableName, Key: identityKey(sub), ConsistentRead: true }),
  )
  if (!Item) return null
  if (Item.deletedAt) throw new AccountDeleted()
  return String(Item.userId)
}
