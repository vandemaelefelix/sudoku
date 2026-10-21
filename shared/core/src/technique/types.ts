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

/** Every list is sorted. A step has at least one placement or one elimination. */
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
}

export type TechniqueRank = {
  readonly technique: TechniqueId
  /** Difficulty in Sudoku Explainer points. */
  readonly weight: number
  /** Only for hiddenSingle: the kinds of unit that this rank searches. */
  readonly unitKinds?: readonly UnitKind[]
}
