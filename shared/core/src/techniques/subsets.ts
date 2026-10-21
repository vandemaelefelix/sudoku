import { bitCount, cellsWith, combinations, DIGITS, digitsOf, makeStep, UNITS } from './scan'
import type { CandidateState, Technique, TechniqueId } from './types'

/**
 * `size` cells of a unit hold only `size` digits between them. Those digits leave the other cells.
 * A cell needs two candidates at least, so a naked single stays with its own technique.
 */
function nakedSubset(id: TechniqueId, size: number, state: CandidateState) {
  for (const { ref, cells } of UNITS) {
    const open = cells.filter((cell) => {
      const count = bitCount(state.candidates[cell]!)
      return count >= 2 && count <= size
    })
    for (const subset of combinations(open, size)) {
      const mask = subset.reduce((all, cell) => all | state.candidates[cell]!, 0)
      if (bitCount(mask) !== size) continue
      const eliminations = cells
        .filter((cell) => !subset.includes(cell))
        .flatMap((cell) => digitsOf(state.candidates[cell]! & mask).map((digit) => ({ cell, digit })))
      if (eliminations.length === 0) continue
      return makeStep(id, { eliminations, units: [ref], cells: subset, digits: digitsOf(mask) })
    }
  }
  return null
}

/**
 * `size` digits of a unit fit in only `size` cells. Those cells lose their other digits.
 * A digit needs two cells at least, so a hidden single stays with its own technique.
 */
function hiddenSubset(id: TechniqueId, size: number, state: CandidateState) {
  for (const { ref, cells } of UNITS) {
    const spread = DIGITS.filter((digit) => {
      const count = cellsWith(state, cells, digit).length
      return count >= 2 && count <= size
    })
    for (const subset of combinations(spread, size)) {
      const where = cells.filter((cell) => subset.some((digit) => state.candidates[cell]! & (1 << digit)))
      if (where.length !== size) continue
      const keep = subset.reduce((mask, digit) => mask | (1 << digit), 0)
      const eliminations = where.flatMap((cell) =>
        digitsOf(state.candidates[cell]! & ~keep).map((digit) => ({ cell, digit })),
      )
      if (eliminations.length === 0) continue
      return makeStep(id, { eliminations, units: [ref], cells: where, digits: subset })
    }
  }
  return null
}

export const nakedPair: Technique = { id: 'naked-pair', find: (state) => nakedSubset('naked-pair', 2, state) }
export const hiddenPair: Technique = { id: 'hidden-pair', find: (state) => hiddenSubset('hidden-pair', 2, state) }
export const nakedTriple: Technique = { id: 'naked-triple', find: (state) => nakedSubset('naked-triple', 3, state) }
export const hiddenTriple: Technique = { id: 'hidden-triple', find: (state) => hiddenSubset('hidden-triple', 3, state) }
export const nakedQuad: Technique = { id: 'naked-quad', find: (state) => nakedSubset('naked-quad', 4, state) }
export const hiddenQuad: Technique = { id: 'hidden-quad', find: (state) => hiddenSubset('hidden-quad', 4, state) }
