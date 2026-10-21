import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { generate, LEVELS } from '../generator'
import { createRandom, shuffled } from '../random'
import { computeCandidates } from './candidates'
import { nextSteps } from './nextSteps'
import { TECHNIQUE_ORDER, TIER_1_ORDER } from './order'
import { playThrough } from './playThrough'
import { expectWellFormed } from './stepChecks'
import { boardWith, struck } from './testKit'
import type { Candidates, Step } from './types'

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1)
const FILLS = [0, 10, 20, 30]

const focusKey = (step: Step): number => step.units[0]! * 100 + step.pattern[0]!

function isSortedAndUnique(values: readonly number[]): boolean {
  return values.every((value, i) => i === 0 || values[i - 1]! < value)
}

function checkStep(step: Step, before: readonly number[], candidates: Candidates, solution: readonly number[]): void {
  expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0)
  for (const { cell, digit } of step.placements) {
    expect(before[cell]).toBe(0)
    expect(digit).toBe(solution[cell])
    expect(candidates[cell]! & (1 << (digit - 1))).not.toBe(0)
  }
  for (const { cell, digit } of step.eliminations) {
    expect(digit).not.toBe(solution[cell])
    expect(candidates[cell]! & (1 << (digit - 1))).not.toBe(0)
  }
  const keys = step.eliminations.map(({ cell, digit }) => cell * 10 + digit)
  expect(isSortedAndUnique(keys)).toBe(true)
  expectWellFormed(step)
}

describe('TECHNIQUE_ORDER', () => {
  it('never lowers the weight down the table', () => {
    const weights = TECHNIQUE_ORDER.map((rank) => rank.weight)
    const increases = weights.map((weight, i) => i === 0 || weight >= weights[i - 1]!)
    expect(increases.every(Boolean)).toBe(true)
  })

  it('lists the tier 2 techniques after the tier 1 techniques of the same weight', () => {
    expect(TECHNIQUE_ORDER.map((rank) => rank.technique)).toEqual([
      'fullHouse',
      'hiddenSingle',
      'hiddenSingle',
      'nakedSingle',
      'pointing',
      'boxLine',
      'nakedPair',
      'xWing',
      'hiddenPair',
      'nakedTriple',
      'swordfish',
      'hiddenTriple',
      'skyscraper',
      'twoStringKite',
      'xyWing',
      'xyzWing',
      'wWing',
      'nakedQuad',
      'jellyfish',
      'hiddenQuad',
    ])
    expect(TIER_1_ORDER).toHaveLength(10)
  })

  it('names a hidden single in a box before one in a row or column', () => {
    const ranks = TECHNIQUE_ORDER.filter((rank) => rank.technique === 'hiddenSingle')
    expect(ranks.map((rank) => rank.unitKinds)).toEqual([['box'], ['row', 'column']])
  })
})

describe('nextSteps', () => {
  it('returns only the steps of the easiest technique', () => {
    const board = boardWith({ 5: 1, 17: 1, 27: 1, 64: 1 })
    const pointing = struck(computeCandidates(board), [2, 9, 10, 11, 18, 19, 20], [5])
    const steps = nextSteps(pointing, board)
    expect(steps.map((step) => step.technique)).toEqual(['hiddenSingle'])
    expect(steps[0]!.placements).toEqual([{ cell: 20, digit: 1 }])
  })

  it('searches only the ranks that the caller gives', () => {
    const run = playThrough(generate('expert', 1).givens, TIER_1_ORDER)
    const { board, candidates } = run.final
    expect(nextSteps(candidates, board, TIER_1_ORDER)).toEqual([])
  })

  it('finds nothing on an empty board', () => {
    const board = createEmptyGrid()
    expect(nextSteps(computeCandidates(board), board)).toEqual([])
  })

  it('finds nothing when an empty cell has no candidates, even if a step would apply elsewhere', () => {
    const board = createEmptyGrid()
    const candidates = computeCandidates(board)
    candidates[40] = 1
    expect(nextSteps(candidates, board)).toHaveLength(1)
    candidates[0] = 0
    expect(nextSteps(candidates, board)).toEqual([])
  })

  it('does not count a placed cell as a cell without candidates', () => {
    const board = boardWith({ 0: 5 })
    const candidates = computeCandidates(board)
    candidates[40] = 1
    expect(nextSteps(candidates, board)).toHaveLength(1)
  })

  it('refuses arguments of the wrong size', () => {
    expect(() => nextSteps(new Uint16Array(80), createEmptyGrid())).toThrow(RangeError)
    expect(() => nextSteps(new Uint16Array(81), [])).toThrow(RangeError)
  })

  it('sorts the steps by focus unit, then first pattern cell', () => {
    const { board, candidates } = playThrough(generate('easy', 1).givens).positions[1]!
    const steps = nextSteps(candidates, board)
    expect(steps.length).toBeGreaterThan(1)
    const keys = steps.map(focusKey)
    expect(keys.every((key, i) => i === 0 || keys[i - 1]! <= key)).toBe(true)
  })
})

describe('every step of every position never contradicts the unique solution', () => {
  describe.for(LEVELS)('%s', (level) => {
    it.for(SEEDS)('seed %i, with 0, 10, 20 and 30 solution digits filled in', (seed) => {
      const puzzle = generate(level, seed)
      for (const fill of FILLS) {
        const random = createRandom(seed * 100 + fill)
        const board = [...puzzle.givens]
        const empty = board.flatMap((digit, index) => (digit === 0 ? [index] : []))
        for (const cell of shuffled(empty, random).slice(0, fill)) board[cell] = puzzle.solution[cell]!
        const run = playThrough(board)
        let checked = 0
        for (const { board: before, candidates } of run.positions) {
          for (const step of nextSteps(candidates, before)) {
            checkStep(step, before, candidates, puzzle.solution)
            checked++
          }
        }
        expect(checked).toBeGreaterThanOrEqual(run.steps.length)
      }
    })
  })
})

describe('determinism', () => {
  it('gives the same steps for the same input and leaves the input as it was', () => {
    const puzzle = generate('hard', 3)
    const run = playThrough(puzzle.givens)
    expect(run.steps.length).toBeGreaterThan(10)
    for (const { board, candidates } of run.positions) {
      const boardCopy = [...board]
      const candidatesCopy = new Uint16Array(candidates)
      const first = nextSteps(candidates, board)
      expect(nextSteps(candidates, board)).toEqual(first)
      expect(board).toEqual(boardCopy)
      expect(candidates).toEqual(candidatesCopy)
    }
  })

  it('does not depend on the order in which the positions are asked', () => {
    const run = playThrough(generate('medium', 9).givens)
    const forward = run.positions.map(({ board, candidates }) => nextSteps(candidates, board))
    const again: Step[][] = []
    for (let i = run.positions.length - 1; i >= 0; i--) {
      const { board, candidates } = run.positions[i]!
      again[i] = nextSteps(candidates, board)
    }
    expect(again).toEqual(forward)
  })
})
