import { describe, expect, it } from 'vitest'
import { generate, LEVELS, type Level } from '../generator'
import { applyStep, createCandidateState } from './candidates'
import { solveWithTechniques } from './solve'
import { nakedSingle } from './singles'

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1)
const PROPERTY_SEEDS = SEEDS.slice(0, 40)

describe('solveWithTechniques', () => {
  it('solves an easy puzzle with the solution', () => {
    const { givens, solution } = generate('easy', 1)
    const result = solveWithTechniques(givens)
    expect(result.status).toBe('solved')
    expect(result.values).toEqual(solution)
    expect(result.steps.length).toBeGreaterThan(0)
  })

  it('gives the same steps for the same puzzle', () => {
    const { givens } = generate('hard', 7)
    expect(solveWithTechniques(givens)).toEqual(solveWithTechniques(givens))
  })

  it('stalls without a step when no technique is allowed', () => {
    const { givens } = generate('easy', 1)
    expect(solveWithTechniques(givens, { techniques: [] })).toEqual({ status: 'stalled', steps: [], values: givens })
  })

  it('uses only the techniques it may use', () => {
    const { givens } = generate('easy', 2)
    const { steps } = solveWithTechniques(givens, { techniques: [nakedSingle] })
    expect(new Set(steps.map((step) => step.technique))).toEqual(new Set(['naked-single']))
  })

  it('says invalid for a row with the same digit twice', () => {
    const givens = Array.from({ length: 81 }, () => 0)
    givens[0] = 5
    givens[8] = 5
    expect(solveWithTechniques(givens).status).toBe('invalid')
  })

  it('says invalid for a cell without a candidate', () => {
    const givens = Array.from({ length: 81 }, () => 0)
    ;[1, 2, 3, 4].forEach((digit, k) => (givens[k + 1] = digit))
    ;[5, 6, 7, 8].forEach((digit, k) => (givens[(k + 1) * 9] = digit))
    givens[10] = 9
    expect(solveWithTechniques(givens).status).toBe('invalid')
  })

  it('refuses a grid of the wrong size', () => {
    expect(() => solveWithTechniques([1, 2, 3])).toThrow(RangeError)
  })
})

describe.for(LEVELS)('%s puzzles', (level) => {
  it('never places a wrong digit and never removes a digit of the solution', () => {
    for (const seed of PROPERTY_SEEDS) {
      const { givens, solution } = generate(level, seed)
      const { status, steps, values } = solveWithTechniques(givens)
      expect(status).not.toBe('invalid')
      let state = createCandidateState(givens)
      for (const step of steps) {
        expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0)
        for (const { cell, digit } of step.placements) {
          expect(state.values[cell]).toBe(0)
          expect(digit).toBe(solution[cell])
        }
        for (const { cell, digit } of step.eliminations) {
          expect(state.candidates[cell]! & (1 << digit)).not.toBe(0)
          expect(digit).not.toBe(solution[cell])
        }
        state = applyStep(state, step)
      }
      expect(values.filter((value, cell) => value !== 0 && value !== solution[cell])).toEqual([])
    }
  })

  it('records the time and the share that the basic techniques solve', async ({ annotate }) => {
    const puzzles = SEEDS.map((seed) => generate(level as Level, seed))
    const timed = puzzles.map(({ givens }) => {
      const start = performance.now()
      const { status } = solveWithTechniques(givens)
      return { status, ms: performance.now() - start }
    })
    const slowest = Math.max(...timed.map(({ ms }) => ms))
    const solved = timed.filter(({ status }) => status === 'solved').length
    await annotate(`slowest of ${SEEDS.length}: ${slowest.toFixed(1)} ms`, 'technique solve time')
    await annotate(`solved ${solved}, stalled ${SEEDS.length - solved}`, 'technique solve status')
    expect(slowest).toBeLessThan(20)
  })
})
