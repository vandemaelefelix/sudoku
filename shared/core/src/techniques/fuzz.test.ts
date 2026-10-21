import { describe, expect, it } from 'vitest'
import { generate, LEVELS } from '../generator'
import { createRandom } from '../random'
import { peersOf } from '../units'
import { applyStep } from './candidates'
import { DIGITS } from './scan'
import { TECHNIQUES } from './techniques'
import type { CandidateState } from './types'

const STATES_PER_SOLUTION = 60

/**
 * A superset of the solution. Some cells hold their digit, and their peers lose it. Each other cell
 * loses random extra digits, but never its solution digit.
 */
function fuzzState(solution: readonly number[], random: () => number): CandidateState {
  const given = 0.2 + random() * 0.6
  const drop = random() * 0.7
  const values = solution.map((digit) => (random() < given ? digit : 0))
  const candidates = values.map((value, cell) => {
    if (value !== 0) return 0
    const kept = DIGITS.reduce(
      (mask, digit) => (digit === solution[cell] || random() >= drop ? mask | (1 << digit) : mask),
      0,
    )
    return peersOf(cell).reduce((mask, peer) => mask & ~(1 << values[peer]!), kept)
  })
  return { values, candidates }
}

describe('technique fuzz', () => {
  const states: { state: CandidateState; solution: readonly number[] }[] = []
  LEVELS.forEach((level, index) => {
    for (let seed = 1; seed <= 4; seed++) {
      const { solution } = generate(level, seed)
      const random = createRandom(index * 100 + seed)
      for (let i = 0; i < STATES_PER_SOLUTION; i++) states.push({ state: fuzzState(solution, random), solution })
    }
  })

  const fired = new Map<string, number>()

  it.for(TECHNIQUES)('$id returns only sound steps', (technique) => {
    let count = 0
    for (const { state, solution } of states) {
      const step = technique.find(state)
      if (!step) continue
      count++
      expect(step.technique).toBe(technique.id)
      expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0)
      for (const { cell, digit } of step.placements) {
        expect(state.values[cell]).toBe(0)
        expect(digit).toBe(solution[cell])
      }
      for (const { cell, digit } of step.eliminations) {
        expect(state.values[cell]).toBe(0)
        expect(state.candidates[cell]! & (1 << digit)).not.toBe(0)
        expect(digit).not.toBe(solution[cell])
      }
      const next = applyStep(state, step)
      expect(next).not.toEqual(state)
    }
    fired.set(technique.id, count)
  })

  it('fires every technique at least once', () => {
    expect([...fired.entries()].filter(([, count]) => count === 0)).toEqual([])
    expect(fired.size).toBe(TECHNIQUES.length)
  })
})
