import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import { MAX_JPEG_BYTES, SCAN_SCHEMA_VERSION, validateScanRecord } from './index'

const fixtureDir = join(import.meta.dirname, '../../fixtures/scan-records')
const schema = JSON.parse(readFileSync(join(import.meta.dirname, '../scan-record.schema.json'), 'utf8'))
const fixtures = readdirSync(fixtureDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ name, data: JSON.parse(readFileSync(join(fixtureDir, name), 'utf8')) }))

const good = () => structuredClone(fixtures.find((f) => f.name === 'good-1.json')!.data)

describe('constants', () => {
  it('exports the version and the photo limit', () => {
    expect(SCAN_SCHEMA_VERSION).toBe(1)
    expect(MAX_JPEG_BYTES).toBe(1_000_000)
  })
})

describe('validateScanRecord', () => {
  it('accepts a good record', () => {
    const result = validateScanRecord(good())
    expect(result.ok).toBe(true)
  })

  it('rejects a non-object', () => {
    expect(validateScanRecord(null).ok).toBe(false)
  })

  it('rejects a wrong schema version', () => {
    const r = good()
    r.schemaVersion = 2
    expect(validateScanRecord(r).ok).toBe(false)
  })

  it('rejects 80 cells', () => {
    const r = good()
    r.cells.pop()
    expect(validateScanRecord(r)).toMatchObject({ ok: false })
  })

  it('rejects a probability above 1 or below 0', () => {
    const high = good()
    high.cells[0]!.kindProbs = [1.5, -0.5, 0, 0]
    expect(validateScanRecord(high).ok).toBe(false)
  })

  it('rejects probabilities that do not sum to 1 within 1e-3', () => {
    const r = good()
    r.cells[3]!.digitProbs[0] = 0.5
    expect(validateScanRecord(r).ok).toBe(false)
    const near = good()
    near.cells[3]!.digitProbs[0] += 5e-4
    expect(validateScanRecord(near).ok).toBe(true)
  })

  it('rejects a wrong number of probabilities', () => {
    const r = good()
    r.cells[0]!.digitProbs.pop()
    expect(validateScanRecord(r).ok).toBe(false)
  })

  it('rejects a corner outside [0, 1]', () => {
    const r = good()
    r.corners[0] = [-0.1, 0.1]
    expect(validateScanRecord(r).ok).toBe(false)
  })

  it('rejects a quad that is not convex', () => {
    const r = good()
    r.corners = [
      [0.1, 0.1],
      [0.9, 0.9],
      [0.9, 0.1],
      [0.1, 0.9],
    ]
    expect(validateScanRecord(r).ok).toBe(false)
  })

  it('rejects a degenerate quad', () => {
    const r = good()
    r.corners = [
      [0.1, 0.1],
      [0.2, 0.2],
      [0.3, 0.3],
      [0.4, 0.4],
    ]
    expect(validateScanRecord(r).ok).toBe(false)
  })

  it('rejects a final digit or kind out of range', () => {
    const r = good()
    r.cells[0]!.finalDigit = 10
    expect(validateScanRecord(r).ok).toBe(false)
    const k = good()
    k.cells[0]!.finalKind = 4
    expect(validateScanRecord(k).ok).toBe(false)
  })

  it('rejects a scanId that is not a UUID', () => {
    const r = good()
    r.scanId = 'abc'
    expect(validateScanRecord(r).ok).toBe(false)
  })
})

describe('fixtures', () => {
  const validate = new Ajv2020({ strict: true }).compile(schema)

  it('has 3 good and 4 bad records', () => {
    expect(fixtures.filter((f) => f.name.startsWith('good-'))).toHaveLength(3)
    expect(fixtures.filter((f) => f.name.startsWith('bad-'))).toHaveLength(4)
  })

  for (const { name, data } of fixtures) {
    const isGood = name.startsWith('good-')
    it(`${name} ${isGood ? 'passes' : 'fails'} the validator`, () => {
      expect(validateScanRecord(data).ok).toBe(isGood)
    })
  }

  // The schema cannot express the probability sum or convexity. The bad-probability-sum
  // and bad-corners-not-convex fixtures therefore pass the schema.
  const schemaRejects = new Set(['bad-cell-count.json', 'bad-schema-version.json'])
  for (const { name, data } of fixtures) {
    const expected = !schemaRejects.has(name)
    it(`${name} ${expected ? 'passes' : 'fails'} the JSON Schema`, () => {
      expect(validate(data)).toBe(expected)
    })
  }
})
