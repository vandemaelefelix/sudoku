import type { Step, TechniqueId, TechniqueRank } from './types'

/**
 * The order in which a person finds the techniques, with the difficulty rating of each one in Sudoku
 * Explainer points. The ratings are in docs/research/2026-10-21-technique-coverage.md.
 * A hidden single in a box rates lower than one in a row or column, so it has its own rank.
 */
export const TECHNIQUE_ORDER: readonly TechniqueRank[] = [
  { technique: 'fullHouse', weight: 1.0 },
  { technique: 'hiddenSingle', weight: 1.2, unitKinds: ['box'] },
  { technique: 'hiddenSingle', weight: 1.5, unitKinds: ['row', 'column'] },
  { technique: 'nakedSingle', weight: 2.3 },
  { technique: 'pointing', weight: 2.6 },
  { technique: 'boxLine', weight: 2.8 },
  { technique: 'nakedPair', weight: 3.0 },
  { technique: 'xWing', weight: 3.2 },
  { technique: 'hiddenPair', weight: 3.4 },
  { technique: 'nakedTriple', weight: 3.6 },
  { technique: 'swordfish', weight: 3.8 },
  { technique: 'hiddenTriple', weight: 4.0 },
  { technique: 'skyscraper', weight: 4.0 },
  { technique: 'twoStringKite', weight: 4.1 },
  { technique: 'xyWing', weight: 4.2 },
  { technique: 'xyzWing', weight: 4.4 },
  { technique: 'wWing', weight: 4.4 },
  { technique: 'uniqueRectangle', weight: 4.5, needsUnique: true },
  { technique: 'simpleColouring', weight: 4.6 },
  { technique: 'nakedQuad', weight: 5.0 },
  { technique: 'jellyfish', weight: 5.2 },
  { technique: 'hiddenQuad', weight: 5.4 },
  { technique: 'xChain', weight: 6.5 },
  { technique: 'xyChain', weight: 6.6 },
]

const TIER_1: ReadonlySet<TechniqueId> = new Set([
  'fullHouse',
  'hiddenSingle',
  'nakedSingle',
  'pointing',
  'boxLine',
  'nakedPair',
  'nakedTriple',
  'hiddenPair',
  'hiddenTriple',
])

/** The ranks of the tier 1 techniques, in the order of `TECHNIQUE_ORDER`. */
export const TIER_1_ORDER: readonly TechniqueRank[] = TECHNIQUE_ORDER.filter((rank) => TIER_1.has(rank.technique))

/** The rating of the rank that finds the step. A hidden single in a box has its own rank. */
export function stepWeight(step: Step): number {
  const kind = step.units[0]! >= 18 ? 'box' : 'row'
  const rank = TECHNIQUE_ORDER.find(
    (item) => item.technique === step.technique && (item.unitKinds === undefined || item.unitKinds.includes(kind)),
  )
  return rank!.weight
}
