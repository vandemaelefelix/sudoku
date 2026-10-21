import { LEVELS, type Level } from '../level'
import { TECHNIQUE_ORDER } from '../technique/order'
import type { TechniqueId, TechniqueRank } from '../technique/types'

/**
 * The level of a technique. The level of a puzzle is the level of its hardest technique (ADR-011,
 * amendment 2026-10-21). A Record, so that a new technique id fails the typecheck until it has a level.
 */
export const TECHNIQUE_LEVEL: Readonly<Record<TechniqueId, Level>> = {
  fullHouse: 'easy',
  hiddenSingle: 'easy',
  nakedSingle: 'easy',
  pointing: 'medium',
  boxLine: 'medium',
  nakedPair: 'medium',
  hiddenPair: 'medium',
  nakedTriple: 'medium',
  hiddenTriple: 'medium',
  xWing: 'hard',
  swordfish: 'hard',
  jellyfish: 'hard',
  skyscraper: 'hard',
  twoStringKite: 'hard',
  xyWing: 'hard',
  xyzWing: 'hard',
  wWing: 'hard',
  nakedQuad: 'hard',
  hiddenQuad: 'hard',
  uniqueRectangle: 'expert',
  simpleColouring: 'expert',
  xChain: 'expert',
  xyChain: 'expert',
}

// TECHNIQUE_ORDER puts the X-wing before the hidden pair. Grading in that order could grade a puzzle
// hard when medium techniques solve it. Each level goes first in its own turn, in the hint order inside it.
export const GRADE_ORDER: readonly TechniqueRank[] = LEVELS.flatMap((level) =>
  TECHNIQUE_ORDER.filter((rank) => TECHNIQUE_LEVEL[rank.technique] === level),
)
