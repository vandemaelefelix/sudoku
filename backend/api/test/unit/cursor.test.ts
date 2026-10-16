import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  InvalidCursor,
  assertCursorOwner,
  assertCursorRange,
  decodeCursor,
  encodeCursor,
  nextCursor,
  type Cursor,
} from '../../src/cursor'

const T1 = '2026-10-15T09:00:00.000Z'
const T2 = '2026-10-15T09:05:00.000Z'
const T3 = '2026-10-15T09:10:00.000Z'
const after = { pk: 'USER#u-1', sk: 'GAME#g-1', syncedAt: T2 }

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('encodeCursor and decodeCursor', () => {
  it('round-trip a cursor', () => {
    const cursor: Cursor = { v: 1, since: T1, after }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('encode base64url of the JSON, without padding', () => {
    const encoded = encodeCursor({ v: 1, since: null, after: null })
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual({ v: 1, since: null, after: null })
  })

  it('read a null cursor as a full pull', () => {
    expect(decodeCursor(null)).toEqual({ v: 1, since: null, after: null })
  })

  it.each([
    ['not base64url', 'abc+/='],
    ['not JSON', Buffer.from('nope').toString('base64url')],
    ['JSON null', encodeJson(null)],
    ['another version', encodeJson({ v: 2, since: null, after: null })],
    ['an extra key', encodeJson({ v: 1, since: null, after: null, userId: 'u-2' })],
    ['an extra key in after', encodeJson({ v: 1, since: null, after: { ...after, extra: 1 } })],
    ['a since without milliseconds', encodeJson({ v: 1, since: '2026-10-15T09:00:00Z', after: null })],
    ['an after that is not a game row', encodeJson({ v: 1, since: null, after: { ...after, sk: 'COUNT#2026-10-15' } })],
    ['a missing after', encodeJson({ v: 1, since: null })],
  ])('refuse %s', (_name, encoded) => {
    expect(() => decodeCursor(encoded)).toThrow(InvalidCursor)
  })
})

describe('nextCursor (ADR-028 decision 6)', () => {
  it('keeps the same since and puts the key in after when DynamoDB returns a LastEvaluatedKey', () => {
    const request: Cursor = { v: 1, since: T1, after: null }
    const lastKey = { pk: 'USER#u-1', sk: 'GAME#g-9', syncedAt: T3 }
    expect(nextCursor(request, [{ syncedAt: T3 }], lastKey)).toEqual({
      cursor: { v: 1, since: T1, after: lastKey },
      more: true,
    })
  })

  it('sets since to the syncedAt of the last row when the read ends', () => {
    const request: Cursor = { v: 1, since: T1, after }
    expect(nextCursor(request, [{ syncedAt: T2 }, { syncedAt: T3 }], undefined)).toEqual({
      cursor: { v: 1, since: T3, after: null },
      more: false,
    })
  })

  it('takes since from the after of the request when it read no rows after a page edge', () => {
    const request: Cursor = { v: 1, since: T1, after }
    expect(nextCursor(request, [], undefined)).toEqual({ cursor: { v: 1, since: T2, after: null }, more: false })
  })

  it('keeps the old since when it read no rows and the request had no after', () => {
    expect(nextCursor({ v: 1, since: T1, after: null }, [], undefined)).toEqual({
      cursor: { v: 1, since: T1, after: null },
      more: false,
    })
    expect(nextCursor({ v: 1, since: null, after: null }, [], undefined)).toEqual({
      cursor: { v: 1, since: null, after: null },
      more: false,
    })
  })

  it('refuses a LastEvaluatedKey that is not a game row of bySynced', () => {
    expect(() => nextCursor({ v: 1, since: null, after: null }, [], { pk: 'USER#u-1', sk: 'GAME#g' })).toThrow(ZodError)
  })
})

describe('assertCursorOwner', () => {
  it('accepts a cursor without after and an after in the partition of the caller', () => {
    expect(() => assertCursorOwner({ v: 1, since: null, after: null }, 'u-1')).not.toThrow(InvalidCursor)
    expect(() => assertCursorOwner({ v: 1, since: T1, after }, 'u-1')).not.toThrow(InvalidCursor)
  })

  it('refuses an after in another partition', () => {
    expect(() => assertCursorOwner({ v: 1, since: T1, after }, 'u-2')).toThrow(InvalidCursor)
  })
})

describe('assertCursorRange', () => {
  it('accepts a full pull, and an after at or after the start of the read', () => {
    expect(() => assertCursorRange({ v: 1, since: null, after: null })).not.toThrow()
    expect(() =>
      assertCursorRange({ v: 1, since: null, after: { ...after, syncedAt: '2000-01-01T00:00:00.000Z' } }),
    ).not.toThrow()
    // The read starts 5 minutes before since (ADR-028 decision 6).
    expect(() => assertCursorRange({ v: 1, since: T3, after })).not.toThrow()
    expect(() => assertCursorRange({ v: 1, since: T3, after: { ...after, syncedAt: T2 } })).not.toThrow()
  })

  it('refuses an after before the start of the read', () => {
    expect(() => assertCursorRange({ v: 1, since: T3, after: { ...after, syncedAt: T1 } })).toThrow(InvalidCursor)
  })
})
