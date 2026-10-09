import { describe, expect, it } from 'vitest'
import { createEmptyGrid, GRID_CELLS } from './index'

describe('createEmptyGrid', () => {
  it('has 81 cells', () => {
    expect(GRID_CELLS).toBe(81)
    expect(createEmptyGrid()).toHaveLength(81)
  })

  it('has only empty cells', () => {
    expect(createEmptyGrid().every((cell) => cell === 0)).toBe(true)
  })

  it('returns a new array each time', () => {
    expect(createEmptyGrid()).not.toBe(createEmptyGrid())
  })
})
