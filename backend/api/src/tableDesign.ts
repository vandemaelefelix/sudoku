// No imports: backend/infra/storage.ts reads this file, so the deployed table and the test table match (ADR-027).

export const BY_SYNCED = 'bySynced'

// ADR-028 decision 9. Only game rows have syncedAt, so bySynced is sparse and a pull never reads other rows.
export const TABLE = {
  fields: { pk: 'string', sk: 'string', syncedAt: 'string' },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  localIndexes: { [BY_SYNCED]: { rangeKey: 'syncedAt' } },
  // A number in epoch seconds. The tombstone and the daily count share it, because a table has one TTL attribute.
  ttl: 'expiresAt',
} as const

export const GAME_PREFIX = 'GAME#'
export const USER_PREFIX = 'USER#'

export function identityKey(sub: string): { pk: string; sk: string } {
  return { pk: `IDENTITY#clerk#${sub}`, sk: 'IDENTITY' }
}

export function userPk(userId: string): string {
  return `${USER_PREFIX}${userId}`
}

export function gameSk(id: string): string {
  return `${GAME_PREFIX}${id}`
}

export function countSk(day: string): string {
  return `COUNT#${day}`
}
