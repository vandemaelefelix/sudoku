import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'

const ALL = 0b1_1111_1111

describe('computeCandidates', () => {
  it('gives every digit to every cell of an empty board', () => {
    const candidates = computeCandidates(createEmptyGrid())
    expect(candidates).toBeInstanceOf(Uint16Array)
    expect(candidates).toHaveLength(81)
    expect(new Set(candidates)).toEqual(new Set([ALL]))
  })

  it('gives a placed cell the mask 0', () => {
    const board = createEmptyGrid()
    board[0] = 5
    expect(computeCandidates(board)[0]).toBe(0)
  })

  it('removes a digit from the 20 peers and from no other cell', () => {
    const board = createEmptyGrid()
    board[40] = 5
    const candidates = computeCandidates(board)
    const withoutFive = ALL & ~(1 << 4)
    const peers = new Set([36, 37, 38, 39, 41, 42, 43, 44, 4, 13, 22, 31, 49, 58, 67, 76, 30, 31, 32, 48, 49, 50])
    const expected = Array.from({ length: 81 }, (_, cell) => {
      if (cell === 40) return 0
      return peers.has(cell) ? withoutFive : ALL
    })
    expect(candidates).toEqual(Uint16Array.from(expected))
  })

  it('sets bit d - 1 for digit d', () => {
    const board = createEmptyGrid()
    board.splice(1, 8, 1, 2, 3, 4, 5, 6, 7, 8)
    expect(computeCandidates(board)[0]).toBe(1 << 8)
  })

  it('leaves a cell without candidates when its peers hold all nine digits', () => {
    const board = createEmptyGrid()
    board.splice(1, 8, 1, 2, 3, 4, 5, 6, 7, 8)
    board[9] = 9
    expect(computeCandidates(board)[0]).toBe(0)
  })

  it('does not change the board', () => {
    const board = createEmptyGrid()
    board[3] = 7
    const copy = [...board]
    computeCandidates(board)
    expect(board).toEqual(copy)
  })

  it('refuses a board of the wrong size', () => {
    expect(() => computeCandidates([1, 2, 3])).toThrow(RangeError)
  })

  it.for([10, -1, 1.5, Number.NaN])('refuses the cell value %s', (value) => {
    const board = createEmptyGrid()
    board[7] = value
    expect(() => computeCandidates(board)).toThrow(RangeError)
  })
})
