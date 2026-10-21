import { ALL_DIGITS, bitCount, cellsWith, DIGITS, digitsOf, makeStep, UNITS } from './scan'
import type { Technique } from './types'

export const fullHouse: Technique = {
  id: 'full-house',
  find({ values, candidates }) {
    for (const { ref, cells } of UNITS) {
      const empty = cells.filter((cell) => values[cell] === 0)
      if (empty.length !== 1) continue
      const cell = empty[0]!
      const missing = cells.reduce((mask, other) => mask & ~(1 << values[other]!), ALL_DIGITS)
      if (bitCount(missing) !== 1 || !(candidates[cell]! & missing)) continue
      const digit = digitsOf(missing)[0]!
      return makeStep('full-house', { placements: [{ cell, digit }], units: [ref], cells: [cell], digits: [digit] })
    }
    return null
  },
}

export const hiddenSingle: Technique = {
  id: 'hidden-single',
  find(state) {
    for (const { ref, cells } of UNITS) {
      for (const digit of DIGITS) {
        const where = cellsWith(state, cells, digit)
        if (where.length !== 1) continue
        const cell = where[0]!
        return makeStep('hidden-single', {
          placements: [{ cell, digit }],
          units: [ref],
          cells: [cell],
          digits: [digit],
        })
      }
    }
    return null
  },
}

export const nakedSingle: Technique = {
  id: 'naked-single',
  find({ candidates }) {
    const cell = candidates.findIndex((mask) => bitCount(mask) === 1)
    if (cell === -1) return null
    const digit = digitsOf(candidates[cell]!)[0]!
    return makeStep('naked-single', { placements: [{ cell, digit }], cells: [cell], digits: [digit] })
  },
}
