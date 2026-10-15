import { describe, expect, it } from 'vitest'
import * as contract from './index'

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
})
