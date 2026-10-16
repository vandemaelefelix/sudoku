import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('@sudoku/core', () => {
  it('exports the game rules', () => {
    const exported: Record<string, unknown> = { ...core }
    for (const name of [
      'createGame',
      'select',
      'place',
      'toggleNote',
      'erase',
      'undo',
      'hint',
      'pause',
      'resume',
      'tick',
      'completeDigits',
      'hasMoves',
      'isWrong',
      'valueAt',
      'toSavedGame',
      'fromSavedGame',
    ]) {
      expect(typeof exported[name]).toBe('function')
    }
    expect(core.MAX_MISTAKES).toBe(3)
  })
})
