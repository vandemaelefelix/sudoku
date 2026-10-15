import { describe, expect, expectTypeOf, it } from 'vitest'
import * as contract from './index'
import type { ErrorCode, SyncRequest, SyncResponse } from './index'

describe('@sudoku/sync-contract', () => {
  it('exports the limits of one sync', () => {
    expect(contract.HISTORY_ENTRY_VERSION).toBe(1)
    expect(contract.MAX_ENTRIES_PER_SYNC).toBe(100)
    expect(contract.MAX_CHANGES_PER_SYNC).toBe(500)
    expect(contract.MAX_CURSOR_LENGTH).toBe(1024)
    expect(contract.MAX_SEED).toBe(4_294_967_295)
    expect(contract.MAX_ERROR_MESSAGE_LENGTH).toBe(500)
  })

  it('exports the history entry schemas', () => {
    expect(contract.historyEntrySchema).toBeDefined()
    expect(contract.levelSchema.options).toEqual(['easy', 'medium', 'hard', 'expert'])
    expect(contract.puzzleSourceSchema.options).toEqual(['generated', 'scanned'])
    expect(contract.gameResultSchema.options).toEqual(['won', 'lost', 'abandoned'])
  })

  it('exports the sync and error schemas', () => {
    expect(contract.syncRequestSchema).toBeDefined()
    expect(contract.syncResponseSchema).toBeDefined()
    expect(contract.errorBodySchema).toBeDefined()
    expect(contract.errorCodeSchema.options).toEqual(['invalid_request', 'daily_limit', 'internal_error'])
  })

  it('types the cursor as a string or null', () => {
    expectTypeOf<SyncRequest['cursor']>().toEqualTypeOf<string | null>()
    expectTypeOf<SyncResponse['cursor']>().toEqualTypeOf<string | null>()
    expectTypeOf<ErrorCode>().toEqualTypeOf<'invalid_request' | 'daily_limit' | 'internal_error'>()
  })
})
