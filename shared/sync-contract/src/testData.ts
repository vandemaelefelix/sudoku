import type { HistoryEntry } from './historyEntry'

export function validEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    schemaVersion: 1,
    id: '3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b',
    level: 'medium',
    source: 'generated',
    result: 'won',
    seed: 123_456,
    playedMs: 754_000,
    mistakes: 1,
    hintsUsed: 2,
    finishedAt: '2026-10-15T09:12:34.567Z',
    createdAt: '2026-10-15T09:12:34.600Z',
    updatedAt: '2026-10-15T09:12:34.600Z',
    deletedAt: null,
    ...overrides,
  }
}

/** A valid entry with a distinct UUID for each n from 0 to 0xffffffff. */
export function entryWithId(n: number): HistoryEntry {
  const tail = n.toString(16).padStart(12, '0')
  return validEntry({ id: `00000000-0000-4000-8000-${tail}` })
}
