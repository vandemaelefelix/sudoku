import { GRID_CELLS } from '../grid'
import { findBoxLineReductions, findPointing } from './intersections'
import { TECHNIQUE_ORDER } from './order'
import { findFullHouses, findHiddenSingles, findNakedSingles } from './singles'
import { findHiddenSubsets, findNakedSubsets } from './subsets'
import type { Candidates, Step, TechniqueRank } from './types'

function findSteps(rank: TechniqueRank, candidates: Candidates, board: readonly number[]): Step[] {
  switch (rank.technique) {
    case 'fullHouse':
      return findFullHouses(candidates, board)
    case 'hiddenSingle':
      return findHiddenSingles(candidates, board, rank.unitKinds ?? ['box', 'row', 'column'])
    case 'nakedSingle':
      return findNakedSingles(candidates, board)
    case 'pointing':
      return findPointing(candidates, board)
    case 'boxLine':
      return findBoxLineReductions(candidates, board)
    case 'nakedPair':
      return findNakedSubsets(candidates, board, 2)
    case 'nakedTriple':
      return findNakedSubsets(candidates, board, 3)
    case 'hiddenPair':
      return findHiddenSubsets(candidates, board, 2)
    case 'hiddenTriple':
      return findHiddenSubsets(candidates, board, 3)
  }
}

function firstDigit(step: Step): number {
  return (step.placements[0] ?? step.eliminations[0])?.digit ?? 0
}

/**
 * Every step of the easiest technique that applies, or [] when no tier 1 technique applies.
 * `candidates` may be smaller than the board gives, for example after earlier eliminations.
 * The steps are sorted by focus unit, first pattern cell and first digit.
 * Throws a RangeError when an argument does not have 81 cells.
 */
export function nextSteps(candidates: Candidates, board: readonly number[]): Step[] {
  if (candidates.length !== GRID_CELLS || board.length !== GRID_CELLS) {
    throw new RangeError(`The candidates and the board have ${GRID_CELLS} cells each`)
  }
  for (const rank of TECHNIQUE_ORDER) {
    const steps = findSteps(rank, candidates, board)
    if (steps.length === 0) continue
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of this call
    return steps.sort(
      (a, b) => a.units[0]! - b.units[0]! || a.pattern[0]! - b.pattern[0]! || firstDigit(a) - firstDigit(b),
    )
  }
  return []
}
