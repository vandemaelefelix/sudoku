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
      'planHint',
      'hintText',
      'revealHint',
      'fillHint',
      'pause',
      'resume',
      'tick',
      'completeDigits',
      'hasMoves',
      'isWrong',
      'valueAt',
      'toSavedGame',
      'fromSavedGame',
      'needsSave',
    ]) {
      expect(typeof exported[name]).toBe('function')
    }
    expect(core.MAX_MISTAKES).toBe(3)
  })

  it('exports the technique solver', () => {
    expect(typeof core.computeCandidates).toBe('function')
    expect(typeof core.nextSteps).toBe('function')
    expect(core.TECHNIQUE_ORDER[0]?.technique).toBe('fullHouse')
    expect(core.UNITS).toHaveLength(27)
  })

  it('exports the technique pages', () => {
    expect(core.techniqueExample('hiddenSingle')?.step.technique).toBe('hiddenSingle')
    expect(core.TECHNIQUE_PAGES.xWing?.explanation).toBeTruthy()
  })
})
