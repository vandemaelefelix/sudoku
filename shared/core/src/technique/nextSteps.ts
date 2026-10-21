import { GRID_CELLS } from '../grid'
import { findXChains, findXyChains } from './chains'
import { findSimpleColouring } from './colouring'
import { findFish } from './fish'
import { findBoxLineReductions, findPointing } from './intersections'
import { TECHNIQUE_ORDER } from './order'
import { findUniqueRectangles } from './rectangles'
import { findFullHouses, findHiddenSingles, findNakedSingles } from './singles'
import { findSkyscrapers, findTwoStringKites } from './singleDigit'
import { findHiddenSubsets, findNakedSubsets } from './subsets'
import { findWWings, findXyWings, findXyzWings } from './wings'
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
    case 'nakedQuad':
      return findNakedSubsets(candidates, board, 4)
    case 'hiddenQuad':
      return findHiddenSubsets(candidates, board, 4)
    case 'xWing':
      return findFish(candidates, board, 2)
    case 'swordfish':
      return findFish(candidates, board, 3)
    case 'jellyfish':
      return findFish(candidates, board, 4)
    case 'skyscraper':
      return findSkyscrapers(candidates, board)
    case 'twoStringKite':
      return findTwoStringKites(candidates, board)
    case 'xyWing':
      return findXyWings(candidates, board)
    case 'xyzWing':
      return findXyzWings(candidates, board)
    case 'wWing':
      return findWWings(candidates, board)
    case 'simpleColouring':
      return findSimpleColouring(candidates, board)
    case 'uniqueRectangle':
      return findUniqueRectangles(candidates, board)
    case 'xChain':
      return findXChains(candidates, board)
    case 'xyChain':
      return findXyChains(candidates, board)
  }
}

export type NextStepsOptions = {
  /**
   * True when the puzzle has exactly one solution, so the ranks with `needsUnique` may run. The
   * unique rectangle is wrong on a puzzle with two solutions. Default false.
   */
  readonly unique?: boolean | undefined
}

function firstDigit(step: Step): number {
  return (step.placements[0] ?? step.eliminations[0])?.digit ?? 0
}

/**
 * Every step of the easiest technique that applies. Returns [] when no technique of `ranks` applies,
 * or when an empty cell has no candidate. `ranks` is the whole table unless a caller measures a
 * smaller set of techniques. A rank with `needsUnique` runs only when `options.unique` is true.
 * `candidates` may be smaller than the board gives, for example after earlier eliminations.
 * The steps are sorted by focus unit, first pattern cell and first digit.
 * Throws a RangeError when an argument does not have 81 cells.
 */
export function nextSteps(
  candidates: Candidates,
  board: readonly number[],
  ranks: readonly TechniqueRank[] = TECHNIQUE_ORDER,
  options: NextStepsOptions = {},
): Step[] {
  if (candidates.length !== GRID_CELLS || board.length !== GRID_CELLS) {
    throw new RangeError(`The candidates and the board have ${GRID_CELLS} cells each`)
  }
  // A step on a contradictory position would teach a wrong lesson.
  if (candidates.some((mask, cell) => mask === 0 && board[cell] === 0)) return []
  for (const rank of ranks) {
    if (rank.needsUnique && !options.unique) continue
    const steps = findSteps(rank, candidates, board)
    if (steps.length === 0) continue
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of this call
    return steps.sort(
      (a, b) => a.units[0]! - b.units[0]! || a.pattern[0]! - b.pattern[0]! || firstDigit(a) - firstDigit(b),
    )
  }
  return []
}
