import { describe, expect, it } from 'vitest'
import { generate, LEVELS } from '../generator'
import { createRandom } from '../random'
import { PEERS, UNITS } from '../units'
import { bitOf } from './masks'
import { nextSteps } from './nextSteps'
import { TECHNIQUE_ORDER } from './order'
import { expectWellFormed } from './stepChecks'
import type { Candidates } from './types'

const STATES_PER_SOLUTION = 100

type State = { board: number[]; candidates: Candidates; solution: readonly number[] }

/**
 * A superset of the solution. Some cells hold their digit, and their peers lose it. Each other cell
 * loses random extra digits, but never its solution digit. Such a position has more candidates
 * than a solve leaves, and it shows each technique often.
 */
function fuzzState(solution: readonly number[], random: () => number): State {
  const given = 0.2 + random() * 0.6
  const drop = random() * 0.7
  const board = solution.map((digit) => (random() < given ? digit : 0))
  const candidates = new Uint16Array(81)
  for (let cell = 0; cell < 81; cell++) {
    if (board[cell] !== 0) continue
    let mask = bitOf(solution[cell]!)
    for (let digit = 1; digit <= 9; digit++) if (random() >= drop) mask |= bitOf(digit)
    for (const peer of PEERS[cell]!) if (board[peer] !== 0) mask &= ~bitOf(board[peer]!)
    candidates[cell] = mask
  }
  return { board, candidates, solution }
}

const states: State[] = LEVELS.flatMap((level, index) =>
  [1, 2, 3, 4].flatMap((seed) => {
    const { solution } = generate(level, seed)
    const random = createRandom(index * 100 + seed)
    return Array.from({ length: STATES_PER_SOLUTION }, () => fuzzState(solution, random))
  }),
)

const fired = new Map<string, number>()

describe('technique fuzz', () => {
  it.for(TECHNIQUE_ORDER.map((rank, index) => ({ rank, index })))(
    'rank $index ($rank.technique) returns only sound steps',
    ({ rank }) => {
      let count = 0
      for (const { board, candidates, solution } of states) {
        const steps = nextSteps(candidates, board, [rank])
        for (const step of steps) {
          count++
          expect(step.technique).toBe(rank.technique)
          expectWellFormed(step)
          expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0)
          for (const { cell, digit } of step.placements) {
            expect(board[cell]).toBe(0)
            expect(digit).toBe(solution[cell])
          }
          for (const { cell, digit } of step.eliminations) {
            expect(board[cell]).toBe(0)
            expect(candidates[cell]! & bitOf(digit)).not.toBe(0)
            expect(digit).not.toBe(solution[cell])
          }
          for (const cell of step.pattern) expect(board[cell]).toBe(0)
          for (const unit of step.units) expect(UNITS[unit]).toBeDefined()
        }
      }
      fired.set(`${rank.technique}/${rank.unitKinds?.join() ?? ''}`, count)
    },
  )

  it('fires every rank at least once', () => {
    expect(fired.size).toBe(TECHNIQUE_ORDER.length)
    expect([...fired.entries()].filter(([, count]) => count === 0)).toEqual([])
  })
})
