import { gameResultSchema, HISTORY_ENTRY_VERSION, levelSchema, puzzleSourceSchema } from '@sudoku/sync-contract'
import { LEVELS } from '@sudoku/core'
import type {
  GameResult as ContractGameResult,
  HistoryEntry as ContractHistoryEntry,
  Level as ContractLevel,
  PuzzleSource as ContractPuzzleSource,
} from '@sudoku/sync-contract'
import type { GameResult, HistoryRecord, Level, PuzzleSource } from './storage.types'
import { meetsContract, parseChanges, toWireEntry } from './wireEntry'

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
// A change of the contract or of the app that makes the two differ fails the typecheck here.
const levelMatches: Same<ContractLevel, Level> = true
const sourceMatches: Same<ContractPuzzleSource, PuzzleSource> = true
const resultMatches: Same<ContractGameResult, GameResult> = true
const recordMatches: Same<Omit<ContractHistoryEntry, 'schemaVersion'>, HistoryRecord> = true

const RECORD: HistoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  level: 'easy',
  source: 'generated',
  seed: 7,
  result: 'won',
  playedMs: 60_000,
  mistakes: 0,
  hintsUsed: 0,
  finishedAt: '2026-10-15T09:00:00.000Z',
  createdAt: '2026-10-15T09:00:00.000Z',
  updatedAt: '2026-10-15T09:00:00.000Z',
  deletedAt: null,
}

describe('the contract and the app agree', () => {
  it('has the same enums', () => {
    expect([levelMatches, sourceMatches, resultMatches, recordMatches]).toEqual([true, true, true, true])
    expect(levelSchema.options).toEqual(LEVELS)
    expect(puzzleSourceSchema.options).toEqual(['generated', 'scanned'])
    expect(gameResultSchema.options).toEqual(['won', 'lost', 'abandoned'])
  })
})

describe('toWireEntry', () => {
  it('adds the schema version', () => {
    expect(toWireEntry(RECORD)).toEqual({ schemaVersion: HISTORY_ENTRY_VERSION, ...RECORD })
  })
})

describe('meetsContract', () => {
  it('accepts a valid record and refuses a record that the server would refuse', () => {
    expect(meetsContract(RECORD)).toBe(true)
    expect(meetsContract({ ...RECORD, id: 'not-a-uuid' })).toBe(false)
    expect(meetsContract({ ...RECORD, playedMs: -1 })).toBe(false)
  })
})

describe('parseChanges', () => {
  it('turns valid changes into records without the schema version', () => {
    expect(parseChanges([toWireEntry(RECORD)])).toEqual({ records: [RECORD], dropped: 0 })
  })

  it('drops a bad change and keeps the rest', () => {
    const other = { ...RECORD, id: '22222222-2222-4222-8222-222222222222' }
    const bad = { ...toWireEntry(RECORD), level: 'insane' }
    expect(parseChanges([toWireEntry(other), bad, 'text', null])).toEqual({ records: [other], dropped: 3 })
  })
})
