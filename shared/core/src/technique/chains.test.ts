import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findXChains, findXyChains } from './chains'
import { expectWellFormed } from './stepChecks'
import { onlyIn } from './testKit'
import type { Candidates, CellDigit } from './types'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const removed = (cells: readonly number[], digit: number): CellDigit[] =>
  cells.map((cell) => ({ cell, digit }) as CellDigit)

// Rings of cells where only the neighbours in the list see each other. Each cell has an end in two
// lines of two cells, so a link between neighbours is strong or weak by turns.
const RING_5 = [0, 3, 13, 31, 27]
const RING_13 = [0, 1, 28, 30, 12, 15, 25, 43, 44, 62, 58, 67, 63]
const RING_15 = [0, 1, 28, 30, 39, 42, 52, 16, 13, 23, 59, 62, 71, 65, 72]

describe('findXChains', () => {
  // The chain 0 = 3 - 13 = 31 has a strong link in row 0, a weak link in box 1 and a strong link in
  // column 4. One of the cells 0 and 31 holds the 5. The cell 27 sees both.
  it('clears the digit from the cell that sees both ends of a chain of three links', () => {
    const steps = findXChains(onlyIn(empty, 5, RING_5), board)
    expect(steps[0]).toEqual({
      technique: 'xChain',
      placements: [],
      eliminations: removed([27], 5),
      units: [0, 19, 13],
      pattern: [0, 3, 13, 31],
      support: [],
      digits: [5],
      links: [
        { from: 0, to: 3, digit: 5, strong: true },
        { from: 3, to: 13, digit: 5, strong: false },
        { from: 13, to: 31, digit: 5, strong: true },
      ],
    })
  })

  it('gives one step for each pair of end cells, so a ring gives one step for each of its cells', () => {
    const steps = findXChains(onlyIn(empty, 5, RING_5), board)
    expect(new Set(steps.map((step) => step.eliminations[0]!.cell))).toEqual(new Set([0, 3, 13, 27, 31]))
    for (const step of steps) expectWellFormed(step)
  })

  it('finds a chain of twelve cells', () => {
    const steps = findXChains(onlyIn(empty, 5, RING_13), board)
    expect(steps[0]!.eliminations).toEqual(removed([63], 5))
    expect(steps[0]!.links).toHaveLength(11)
    expect(steps[0]!.pattern).toEqual([0, 1, 12, 15, 25, 28, 30, 43, 44, 58, 62, 67])
    expect(steps.every((step) => step.links!.length === 11)).toBe(true)
  })

  // A chain of thirteen cells cannot exist: strong and weak links alternate, so the cells are in pairs.
  it('finds nothing when the chain has fourteen cells', () => {
    expect(findXChains(onlyIn(empty, 5, RING_15), board)).toEqual([])
  })

  it('finds nothing when the cell that sees both ends lacks the digit', () => {
    expect(findXChains(onlyIn(empty, 5, RING_5.slice(0, 4)), board)).toEqual([])
  })

  it('keeps only the shortest chains', () => {
    const lengths = findXChains(onlyIn(empty, 5, [...RING_5, 40, 41]), board).map((step) => step.links!.length)
    expect(new Set(lengths).size).toBe(1)
  })

  it('finds nothing in a position where every cell has all nine candidates', () => {
    expect(findXChains(empty, board)).toEqual([])
  })
})

/** Only the listed cells are empty. Each holds the digits that the list gives. */
function chainPosition(digits: Readonly<Record<number, readonly number[]>>): {
  board: number[]
  candidates: Candidates
} {
  const candidates = new Uint16Array(81)
  const cells = Object.keys(digits).map(Number)
  for (const cell of cells) candidates[cell] = digits[cell]!.reduce((mask, digit) => mask | (1 << (digit - 1)), 0)
  return { board: Array.from({ length: 81 }, (_, cell) => (cells.includes(cell) ? 0 : 9)), candidates }
}

/** A chain along the first `count` cells of a ring. Cell k holds the digits x(k) and x(k + 1). The first x and the last x are 1. */
function xyRing(ring: readonly number[], count: number, target = ring[count]!) {
  const x = (k: number) => (k === 0 || k === count ? 1 : ((k - 1) % 8) + 2)
  const digits = Object.fromEntries(ring.slice(0, count).map((cell, k) => [cell, [x(k), x(k + 1)]]))
  return chainPosition({ ...digits, [target]: [1, 5, 6] })
}

describe('findXyChains', () => {
  // 0 {1,2} - 3 {2,3} - 30 {3,4} - 27 {4,1}. If the cell 0 is not 1, it is 2, then 3 is 3, 30 is 4
  // and 27 is 1. So 1 sits in the cell 0 or in the cell 27. Column 0 sees both.
  it('clears the digit from every cell that sees both ends of a chain of four cells', () => {
    const position = chainPosition({
      0: [1, 2],
      3: [2, 3],
      30: [3, 4],
      27: [4, 1],
      9: [1, 5],
      18: [1, 5],
      36: [1, 5],
      45: [1, 5],
    })
    const steps = findXyChains(position.candidates, position.board)
    expect(steps).toEqual([
      {
        technique: 'xyChain',
        placements: [],
        eliminations: removed([9, 18, 36, 45], 1),
        units: [0, 12, 3],
        pattern: [0, 3, 27, 30],
        support: [],
        digits: [1, 2, 3, 4],
        links: [
          { from: 0, to: 3, digit: 2, strong: false },
          { from: 3, to: 30, digit: 3, strong: false },
          { from: 30, to: 27, digit: 4, strong: false },
        ],
      },
    ])
  })

  it('lists the eliminated digit first and the other digits in ascending order', () => {
    const position = chainPosition({ 0: [4, 2], 3: [2, 3], 30: [3, 1], 27: [1, 4], 9: [4, 5] })
    const [step] = findXyChains(position.candidates, position.board)
    expect(step!.digits).toEqual([4, 1, 2, 3])
    expect(step!.pattern).toEqual([0, 3, 27, 30])
    expectWellFormed(step!)
  })

  it('finds a chain of twelve cells', () => {
    const position = xyRing(RING_13, 12)
    const steps = findXyChains(position.candidates, position.board)
    expect(steps[0]!.eliminations).toEqual(removed([63], 1))
    expect(steps[0]!.links).toHaveLength(11)
  })

  it('finds nothing when the chain has thirteen cells', () => {
    const position = xyRing(RING_15, 13, 63)
    expect(findXyChains(position.candidates, position.board)).toEqual([])
  })

  it('finds nothing when the chain has fourteen cells', () => {
    const position = xyRing(RING_15, 14)
    expect(findXyChains(position.candidates, position.board)).toEqual([])
  })

  it('finds nothing when the last cell does not hold the digit of the first', () => {
    const position = chainPosition({ 0: [1, 2], 3: [2, 3], 30: [3, 4], 27: [4, 5], 9: [1, 5] })
    expect(findXyChains(position.candidates, position.board)).toEqual([])
  })

  it('finds nothing in a position where every cell has all nine candidates', () => {
    expect(findXyChains(empty, board)).toEqual([])
  })
})
