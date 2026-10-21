import type { Grid } from '../types'

export type TechniqueId =
  | 'full-house'
  | 'hidden-single'
  | 'naked-single'
  | 'pointing'
  | 'claiming'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'hidden-triple'
  | 'naked-quad'
  | 'hidden-quad'

export type UnitRef = { kind: 'row' | 'column' | 'box'; index: number }

export type CellDigit = { cell: number; digit: number }

/** Plain JSON. `cells` and `digits` hold the pattern, in ascending order. */
export type Step = {
  technique: TechniqueId
  placements: CellDigit[]
  eliminations: CellDigit[]
  /** The units of the pattern. A naked single has none. */
  units: UnitRef[]
  cells: number[]
  digits: number[]
}

/** `candidates[cell]` is a mask where bit d stands for digit d. A filled cell has mask 0. */
export type CandidateState = {
  readonly values: readonly number[]
  readonly candidates: readonly number[]
}

/** `find` returns the first step in scan order. Every step it returns places or eliminates something. */
export type Technique = {
  id: TechniqueId
  find(state: CandidateState): Step | null
}

export type SolveStatus = 'solved' | 'stalled' | 'invalid'

export type TechniqueSolve = { status: SolveStatus; steps: Step[]; values: Grid }
