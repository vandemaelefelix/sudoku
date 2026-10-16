import { describe, expect, it } from 'vitest'
import { historyEntrySchema } from './historyEntry'
import { validEntry } from './testData'

function accepts(value: unknown): boolean {
  return historyEntrySchema.safeParse(value).success
}

describe('historyEntrySchema', () => {
  it('accepts a won generated game', () => {
    expect(historyEntrySchema.parse(validEntry())).toEqual(validEntry())
  })

  it('accepts an abandoned scanned game without a seed', () => {
    expect(accepts(validEntry({ source: 'scanned', result: 'abandoned', seed: null }))).toBe(true)
  })

  it('accepts a soft-deleted entry', () => {
    expect(accepts(validEntry({ deletedAt: '2026-10-16T10:00:00.000Z' }))).toBe(true)
  })

  it.each(['easy', 'medium', 'hard', 'expert'])('accepts the level %s', (level) => {
    expect(accepts({ ...validEntry(), level })).toBe(true)
  })

  it.each(['won', 'lost', 'abandoned'])('accepts the result %s', (result) => {
    expect(accepts({ ...validEntry(), result })).toBe(true)
  })

  it.each([
    ['level', 'insane'],
    ['source', 'photo'],
    ['result', 'draw'],
  ])('refuses a wrong %s', (field, value) => {
    expect(accepts({ ...validEntry(), [field]: value })).toBe(false)
  })

  it.each(['seed', 'playedMs', 'mistakes', 'hintsUsed'])('refuses a negative %s', (field) => {
    expect(accepts({ ...validEntry(), [field]: -1 })).toBe(false)
  })

  it.each(['seed', 'playedMs', 'mistakes', 'hintsUsed'])('refuses a fraction in %s', (field) => {
    expect(accepts({ ...validEntry(), [field]: 1.5 })).toBe(false)
  })

  it('accepts the largest seed', () => {
    expect(accepts(validEntry({ seed: 0xffffffff }))).toBe(true)
  })

  it('refuses a seed above 32 bits', () => {
    expect(accepts(validEntry({ seed: 0x100000000 }))).toBe(false)
  })

  it.each([
    ['a date only', '2026-10-15'],
    ['no decimals', '2026-10-15T09:12:34Z'],
    ['two decimals', '2026-10-15T09:12:34.56Z'],
    ['an offset', '2026-10-15T11:12:34.567+02:00'],
    ['no zone', '2026-10-15T09:12:34.567'],
    ['text', 'yesterday'],
  ])('refuses a time with %s', (_name, time) => {
    for (const field of ['finishedAt', 'createdAt', 'updatedAt', 'deletedAt']) {
      expect(accepts({ ...validEntry(), [field]: time })).toBe(false)
    }
  })

  it('refuses schema version 2', () => {
    expect(accepts({ ...validEntry(), schemaVersion: 2 })).toBe(false)
  })

  it('refuses an entry without a schema version', () => {
    const { schemaVersion: _schemaVersion, ...entry } = validEntry()
    expect(accepts(entry)).toBe(false)
  })

  it('refuses an id that is not a UUID', () => {
    expect(accepts(validEntry({ id: 'game-1' }))).toBe(false)
  })

  it('refuses an entry without deletedAt', () => {
    const { deletedAt: _deletedAt, ...entry } = validEntry()
    expect(accepts(entry)).toBe(false)
  })

  it('strips an unknown key', () => {
    expect(historyEntrySchema.parse({ ...validEntry(), syncedAt: 'x' })).toEqual(validEntry())
  })
})
