import { describe, expect, it } from 'vitest'
import { generate } from '../generator'
import { applyStep, createCandidateState, isContradiction } from './candidates'
import { stateOf } from './testState'
import type { Step } from './types'

const bit = (digit: number) => 1 << digit

const step = (parts: Partial<Step>): Step => ({
  technique: 'naked-single',
  placements: [],
  eliminations: [],
  units: [],
  cells: [],
  digits: [],
  ...parts,
})

describe('createCandidateState', () => {
  it('removes the digits of the peers from an empty cell', () => {
    const grid = Array.from({ length: 81 }, () => 0)
    grid[1] = 5
    grid[9] = 7
    grid[40] = 5
    const state = createCandidateState(grid)
    expect(state.values).toEqual(grid)
    expect(state.candidates[0]).toBe(0b11_1111_1110 & ~bit(5) & ~bit(7))
    expect(state.candidates[1]).toBe(0)
    expect(state.candidates[80]).toBe(0b11_1111_1110)
  })

  it('does not change the grid it gets', () => {
    const { givens } = generate('easy', 3)
    const copy = [...givens]
    createCandidateState(givens)
    expect(givens).toEqual(copy)
  })

  it('refuses a grid of the wrong size or with a bad digit', () => {
    expect(() => createCandidateState([0, 0])).toThrow(RangeError)
    expect(() => createCandidateState(Array.from({ length: 81 }, () => 10))).toThrow(RangeError)
  })
})

describe('applyStep', () => {
  it('places a digit and clears it from the 20 peers only', () => {
    const state = stateOf()
    const next = applyStep(state, step({ placements: [{ cell: 0, digit: 4 }] }))
    expect(next.values[0]).toBe(4)
    expect(next.candidates[0]).toBe(0)
    const cleared = next.candidates.flatMap((mask, cell) => (mask & bit(4) ? [] : [cell]))
    expect(cleared).toHaveLength(21)
    expect(next.candidates[10]).toBe(0b11_1110_1110)
    expect(next.candidates[80]).toBe(0b11_1111_1110)
  })

  it('removes the eliminated candidates', () => {
    const next = applyStep(
      stateOf(),
      step({
        eliminations: [
          { cell: 3, digit: 2 },
          { cell: 3, digit: 9 },
        ],
      }),
    )
    expect(next.candidates[3]).toBe(0b11_1111_1110 & ~bit(2) & ~bit(9))
  })

  it('returns a new state and leaves the old one as it was', () => {
    const state = stateOf()
    const before = JSON.stringify(state)
    applyStep(state, step({ placements: [{ cell: 0, digit: 1 }], eliminations: [{ cell: 5, digit: 1 }] }))
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('isContradiction', () => {
  it('accepts a fresh state', () => {
    expect(isContradiction(stateOf())).toBe(false)
  })

  it('finds an empty cell without a candidate', () => {
    expect(isContradiction(stateOf({ candidates: { 7: [] } }))).toBe(true)
  })

  it('finds a unit that holds a digit twice', () => {
    expect(isContradiction(stateOf({ values: { 0: 3, 5: 3 } }))).toBe(true)
  })

  it('finds a unit that lost a digit', () => {
    const lost = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => [cell, [1, 2, 3, 4, 5, 6, 7, 8]]))
    expect(isContradiction(stateOf({ candidates: lost }))).toBe(true)
  })
})
