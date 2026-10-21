import { claiming, pointing } from './intersections'
import { fullHouse, hiddenSingle, nakedSingle } from './singles'
import { hiddenPair, hiddenQuad, hiddenTriple, nakedPair, nakedQuad, nakedTriple } from './subsets'
import type { Technique } from './types'

/** The solver order. A later layer adds its technique here, in the place of its difficulty. */
export const TECHNIQUES: readonly Technique[] = [
  fullHouse,
  hiddenSingle,
  nakedSingle,
  pointing,
  claiming,
  nakedPair,
  hiddenPair,
  nakedTriple,
  hiddenTriple,
  nakedQuad,
  hiddenQuad,
]
