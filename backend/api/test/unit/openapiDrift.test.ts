import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanAnswerSchema, validateScanRecord } from '@sudoku/scan-contract'
import { syncRequestSchema, syncResponseSchema } from '@sudoku/sync-contract'
import { describe, expect, it } from 'vitest'
import { CreateScanBody, CreateScanHeader, CreateScanResponse, SyncBody, SyncResponse } from '../../.generated/api.zod'

// orval makes the generated schemas from openapi.yaml (`pnpm --filter @sudoku/sync-api generate`).
// The zod contracts in shared/ stay the source of truth. This test fails when the yaml drifts away from them.
const FIXTURES = join(import.meta.dirname, '../../../../shared/fixtures/scan-records')
const scanFixture = (name: string): unknown => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'))

const entry = {
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
}

interface Parser {
  safeParse: (value: unknown) => { success: boolean }
}

function verdict(contract: Parser, spec: Parser, value: unknown) {
  return { contract: contract.safeParse(value).success, spec: spec.safeParse(value).success }
}

describe('openapi.yaml against the zod contracts', () => {
  const syncCases: [string, unknown, boolean][] = [
    ['full pull, no entries', { entries: [], cursor: null }, true],
    ['one entry and a cursor', { entries: [entry], cursor: 'abc' }, true],
    ['deleted entry', { entries: [{ ...entry, deletedAt: entry.updatedAt }], cursor: null }, true],
    ['null seed', { entries: [{ ...entry, seed: null }], cursor: null }, true],
    ['101 entries', { entries: Array.from({ length: 101 }, () => entry), cursor: null }, false],
    ['empty cursor', { entries: [], cursor: '' }, false],
    ['cursor missing', { entries: [] }, false],
    ['unknown level', { entries: [{ ...entry, level: 'insane' }], cursor: null }, false],
    ['negative mistakes', { entries: [{ ...entry, mistakes: -1 }], cursor: null }, false],
    ['seed above 0xffffffff', { entries: [{ ...entry, seed: 0x1_0000_0000 }], cursor: null }, false],
    ['time without milliseconds', { entries: [{ ...entry, finishedAt: '2026-10-15T09:12:34Z' }], cursor: null }, false],
    [
      'time with an offset',
      { entries: [{ ...entry, finishedAt: '2026-10-15T09:12:34.567+02:00' }], cursor: null },
      false,
    ],
    ['wrong schema version', { entries: [{ ...entry, schemaVersion: 2 }], cursor: null }, false],
  ]

  it.each(syncCases)('POST /v1/sync request: %s', (_name, body, accepted) => {
    expect(verdict(syncRequestSchema, SyncBody, body)).toEqual({ contract: accepted, spec: accepted })
  })

  const responseCases: [string, unknown, boolean][] = [
    ['empty', { acceptedIds: [], changes: [], cursor: 'c', more: false }, true],
    ['one change', { acceptedIds: [entry.id], changes: [entry], cursor: 'c', more: true }, true],
    ['empty cursor', { acceptedIds: [], changes: [], cursor: '', more: false }, false],
    ['more missing', { acceptedIds: [], changes: [], cursor: 'c' }, false],
    ['accepted id is not a uuid', { acceptedIds: ['x'], changes: [], cursor: 'c', more: false }, false],
  ]

  it.each(responseCases)('POST /v1/sync response: %s', (_name, body, accepted) => {
    expect(verdict(syncResponseSchema, SyncResponse, body)).toEqual({ contract: accepted, spec: accepted })
  })

  it.each([
    ['good-1', true],
    ['good-2', true],
    ['good-3', true],
    ['bad-cell-count', false],
    ['bad-schema-version', false],
  ])('POST /v1/scans body: %s', (name, accepted) => {
    const record = scanFixture(name)
    expect(validateScanRecord(record).ok).toBe(accepted)
    expect(CreateScanBody.safeParse(record).success).toBe(accepted)
  })

  // OpenAPI cannot state these two rules. Only the zod validator refuses them.
  it.each(['bad-probability-sum', 'bad-corners-not-convex'])('POST /v1/scans body: %s is a known gap', (name) => {
    const record = scanFixture(name)
    expect(validateScanRecord(record).ok).toBe(false)
    expect(CreateScanBody.safeParse(record).success).toBe(true)
  })

  it('POST /v1/scans response', () => {
    const answer = { uploadUrl: 'https://example.com/photo' }
    expect(scanAnswerSchema.safeParse(answer).success).toBe(true)
    expect(CreateScanResponse.safeParse(answer).success).toBe(true)
    expect(scanAnswerSchema.safeParse({}).success).toBe(false)
    expect(CreateScanResponse.safeParse({}).success).toBe(false)
  })

  it.each([
    [1, true],
    [1_000_000, true],
    [0, false],
    [1_000_001, false],
    [1.5, false],
  ])('POST /v1/scans x-jpeg-bytes: %s', (value, accepted) => {
    expect(CreateScanHeader.safeParse({ 'x-jpeg-bytes': value }).success).toBe(accepted)
  })
})
