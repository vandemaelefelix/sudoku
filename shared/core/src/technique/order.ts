import type { TechniqueRank } from './types'

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
  { technique: 'hiddenPair', weight: 3.4 },
  { technique: 'nakedTriple', weight: 3.6 },
  { technique: 'hiddenTriple', weight: 4.0 },
]
