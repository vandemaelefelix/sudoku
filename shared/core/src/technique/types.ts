import type { Digit } from '../game/types'
import type { UnitKind } from '../units'

/** 81 masks, one for each cell. Bit d - 1 is set when digit d is a candidate. A placed cell has the mask 0. */
export type Candidates = Uint16Array

export type CellDigit = { readonly cell: number; readonly digit: Digit }

export type TechniqueId =
  | 'fullHouse'
  | 'hiddenSingle'
  | 'nakedSingle'
  | 'pointing'
  | 'boxLine'
  | 'nakedPair'
  | 'nakedTriple'
  | 'hiddenPair'
  | 'hiddenTriple'
  | 'nakedQuad'
  | 'hiddenQuad'
  | 'xWing'
  | 'swordfish'
  | 'jellyfish'
  | 'skyscraper'
  | 'twoStringKite'
  | 'xyWing'
  | 'xyzWing'
  | 'wWing'
  | 'simpleColouring'
  | 'uniqueRectangle'
  | 'xChain'
  | 'xyChain'

/**
 * Every list is sorted, with three exceptions. The units start with the focus unit. The pattern of
 * a wing lists the pivot (or the two cells of a W-wing) first. The digits of a wing start with the
 * digit that the step removes. The digits of an XY-chain start with the digit that the step removes.
 * A step has at least one placement or one elimination.
 */
export type Step = {
  readonly technique: TechniqueId
  readonly placements: readonly CellDigit[]
  readonly eliminations: readonly CellDigit[]
  /** Unit indices 0 to 26: rows, columns, boxes. The first unit is the focus unit. */
  readonly units: readonly number[]
  /** The cells that form the technique. */
  readonly pattern: readonly number[]
  /** Cells with a digit on the board that cause the step. */
  readonly support: readonly number[]
  /** The digits of the pattern. */
  readonly digits: readonly Digit[]
  /** Chains only: the links in chain order, from the first cell to the last. A link joins two cells that share the digit. */
  readonly links?: readonly ChainLink[]
  /** Simple colouring only: the cells of the two colours. Each list is sorted. Exactly one colour holds the digit. */
  readonly groups?: readonly (readonly number[])[]
}

export type ChainLink = { readonly from: number; readonly to: number; readonly digit: Digit; readonly strong: boolean }

export type TechniqueRank = {
  readonly technique: TechniqueId
  /** Difficulty in Sudoku Explainer points. */
  readonly weight: number
  /** Only for hiddenSingle: the kinds of unit that this rank searches. */
  readonly unitKinds?: readonly UnitKind[]
  /** True when the rank is valid only for a puzzle with exactly one solution. `nextSteps` skips it unless the caller says so. */
  readonly needsUnique?: boolean
}
