import { describe, expect, it } from 'vitest'
import { BY_SYNCED, TABLE, countSk, gameSk, identityKey, userPk } from '../../src/tableDesign'

describe('the table design', () => {
  it('keys the identity row by the Clerk sub (ADR-027 decision 2)', () => {
    expect(identityKey('user_abc')).toEqual({ pk: 'IDENTITY#clerk#user_abc', sk: 'IDENTITY' })
  })

  it('keys the game and the daily count rows by our user ID (ADR-028 decision 9)', () => {
    expect(userPk('u-1')).toBe('USER#u-1')
    expect(gameSk('g-1')).toBe('GAME#g-1')
    expect(countSk('2026-10-15')).toBe('COUNT#2026-10-15')
  })

  it('has the local index bySynced on syncedAt, from the first deploy', () => {
    expect(TABLE.primaryIndex).toEqual({ hashKey: 'pk', rangeKey: 'sk' })
    expect(TABLE.localIndexes).toEqual({ [BY_SYNCED]: { rangeKey: 'syncedAt' } })
    expect(TABLE.fields).toEqual({ pk: 'string', sk: 'string', syncedAt: 'string' })
  })

  it('names one TTL attribute for the tombstone and the daily count', () => {
    expect(TABLE.ttl).toBe('expiresAt')
  })
})
