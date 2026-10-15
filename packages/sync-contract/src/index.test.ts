import { describe, expect, expectTypeOf, it } from 'vitest'
import * as contract from './index'
import { validEntry } from './testData'
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
    expect(contract.historyEntrySchema.parse(validEntry())).toEqual(validEntry())
    expect(contract.levelSchema.options).toEqual(['easy', 'medium', 'hard', 'expert'])
    expect(contract.puzzleSourceSchema.options).toEqual(['generated', 'scanned'])
    expect(contract.gameResultSchema.options).toEqual(['won', 'lost', 'abandoned'])
  })

  it('exports the sync and error schemas', () => {
    const request = { entries: [], cursor: null }
    const response = { acceptedIds: [], changes: [], cursor: 'eyJ2IjoxfQ', more: false }
    const error = { code: 'invalid_cursor', message: 'The cursor is not valid.' }
    expect(contract.syncRequestSchema.parse(request)).toEqual(request)
    expect(contract.syncResponseSchema.parse(response)).toEqual(response)
    expect(contract.errorBodySchema.parse(error)).toEqual(error)
    expect(contract.errorCodeSchema.options).toEqual(['invalid_request', 'invalid_cursor', 'account_deleted'])
  })

  it('types the request cursor as a string or null and the response cursor as a string', () => {
    expectTypeOf<SyncRequest['cursor']>().toEqualTypeOf<string | null>()
    expectTypeOf<SyncResponse['cursor']>().toEqualTypeOf<string>()
    expectTypeOf<ErrorCode>().toEqualTypeOf<'invalid_request' | 'invalid_cursor' | 'account_deleted'>()
  })
})
