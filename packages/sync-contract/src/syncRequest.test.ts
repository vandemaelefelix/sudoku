import { describe, expect, it } from 'vitest'
import { syncRequestSchema } from './syncRequest'
import { entryWithId, validEntry } from './testData'

function accepts(value: unknown): boolean {
  return syncRequestSchema.safeParse(value).success
}

function entries(count: number) {
  return Array.from({ length: count }, (_, n) => entryWithId(n))
}

describe('syncRequestSchema', () => {
  it('accepts a request with entries and a cursor', () => {
    const request = { entries: [validEntry()], cursor: 'eyJ2IjoxfQ' }
    expect(syncRequestSchema.parse(request)).toEqual(request)
  })

  it('accepts a first sync without entries and without a cursor', () => {
    expect(accepts({ entries: [], cursor: null })).toBe(true)
  })

  it('accepts 100 entries', () => {
    expect(accepts({ entries: entries(100), cursor: null })).toBe(true)
  })

  it('refuses 101 entries', () => {
    expect(accepts({ entries: entries(101), cursor: null })).toBe(false)
  })

  it('refuses a request without a cursor', () => {
    expect(accepts({ entries: [] })).toBe(false)
  })

  it('refuses an empty cursor', () => {
    expect(accepts({ entries: [], cursor: '' })).toBe(false)
  })

  it('accepts a cursor of 1024 characters', () => {
    expect(accepts({ entries: [], cursor: 'a'.repeat(1024) })).toBe(true)
  })

  it('refuses a cursor of 1025 characters', () => {
    expect(accepts({ entries: [], cursor: 'a'.repeat(1025) })).toBe(false)
  })

  it('refuses a request with a bad entry', () => {
    expect(accepts({ entries: [{ ...validEntry(), mistakes: -1 }], cursor: null })).toBe(false)
  })
})
