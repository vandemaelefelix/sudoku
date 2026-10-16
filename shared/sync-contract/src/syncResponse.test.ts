import { describe, expect, it } from 'vitest'
import { syncResponseSchema } from './syncResponse'
import { entryWithId, validEntry } from './testData'

function accepts(value: unknown): boolean {
  return syncResponseSchema.safeParse(value).success
}

function response(overrides: Record<string, unknown> = {}) {
  return { acceptedIds: [validEntry().id], changes: [validEntry()], cursor: 'eyJ2IjoxfQ', more: false, ...overrides }
}

function changes(count: number) {
  return Array.from({ length: count }, (_, n) => entryWithId(n))
}

describe('syncResponseSchema', () => {
  it('accepts a response with ids, changes and a cursor', () => {
    expect(syncResponseSchema.parse(response())).toEqual(response())
  })

  it('accepts 500 changes', () => {
    expect(accepts(response({ changes: changes(500), more: true }))).toBe(true)
  })

  it('refuses 501 changes', () => {
    expect(accepts(response({ changes: changes(501) }))).toBe(false)
  })

  it('accepts no accepted ids, as at the daily count', () => {
    expect(accepts(response({ acceptedIds: [] }))).toBe(true)
  })

  it('refuses 101 accepted ids', () => {
    expect(accepts(response({ acceptedIds: changes(101).map((entry) => entry.id) }))).toBe(false)
  })

  it('refuses an accepted id that is not a UUID', () => {
    expect(accepts(response({ acceptedIds: ['game-1'] }))).toBe(false)
  })

  it('refuses more as a string', () => {
    expect(accepts(response({ more: 'true' }))).toBe(false)
  })

  it('refuses a response without more', () => {
    const { more: _more, ...rest } = response()
    expect(accepts(rest)).toBe(false)
  })

  it('refuses a null cursor', () => {
    expect(accepts(response({ cursor: null }))).toBe(false)
  })

  it('refuses a response with a bad change', () => {
    expect(accepts(response({ changes: [{ ...validEntry(), level: 'insane' }] }))).toBe(false)
  })
})
