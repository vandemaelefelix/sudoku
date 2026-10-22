import type { TechniqueId } from '../technique/types'

/**
 * The hint text as data (ADR-032, amendment "the hint text is ids with values"; ADR-033). The core holds no player text: the app
 * formats each message and each part from its catalogue, in the language of the player.
 */

/**
 * A part of a sentence that each language writes its own way. Cells and units are indexes: a cell 0-80 row-major, a unit 0-8
 * rows, 9-17 columns, 18-26 boxes.
 * - cell: one cell, by its row and column. Never "r4c9" (ADR-032, point 10).
 * - cells: several cells, by their shared row or column when they have one.
 * - unit: a row, a column or a box.
 * - units: a list of units, joined with "and".
 * - cellsIn: cells of one unit, without the name of the unit: "columns 1 and 5" in a row.
 * - lines: rows or columns, as "rows 2 and 7". Other units are listed by name.
 * - digits: a list of digits, joined with "and" or "or".
 */
export type HintPart =
  | { readonly kind: 'cell'; readonly cell: number }
  | { readonly kind: 'cells'; readonly cells: readonly number[] }
  | { readonly kind: 'unit'; readonly unit: number }
  | { readonly kind: 'units'; readonly units: readonly number[] }
  | { readonly kind: 'cellsIn'; readonly unit: number; readonly cells: readonly number[] }
  | { readonly kind: 'lines'; readonly units: readonly number[] }
  | { readonly kind: 'digits'; readonly digits: readonly number[]; readonly joiner: 'and' | 'or' }

/** A digit, or a part. A digit argument also picks the article in English: "a 5", but "an 8". */
export type HintValue = number | HintPart

/** Every id that hintMessage can give. The app has a message for each one, and its typecheck proves it. */
export const HINT_MESSAGE_IDS = [
  'hint.mistake',
  'hint.fallback',
  'hint.technique',
  'hint.put',
  'hint.look.unit',
  'hint.look.cell',
  'hint.look.digitIn',
  'hint.removeOutside',
  'hint.removeSeeingBoth',
  'hint.removeSeeingAll',
  'hint.fullHouse.look',
  'hint.fullHouse.why',
  'hint.hiddenSingle.why',
  'hint.hiddenSingle.whyLater',
  'hint.nakedSingle.why',
  'hint.nakedSingle.whyLater',
  'hint.pointing.why',
  'hint.boxLine.why',
  'hint.nakedPair.why',
  'hint.nakedTriple.why',
  'hint.nakedQuad.why',
  'hint.nakedSubset.answer',
  'hint.hiddenPair.why',
  'hint.hiddenTriple.why',
  'hint.hiddenQuad.why',
  'hint.hiddenSubset.answer',
  'hint.fish.why',
  'hint.linkedPair.why',
  'hint.xyWing.look',
  'hint.xyWing.why',
  'hint.xyzWing.look',
  'hint.xyzWing.why',
  'hint.wWing.look',
  'hint.wWing.why',
] as const

export type HintMessageId = (typeof HINT_MESSAGE_IDS)[number]

/**
 * One hint card text: at most two short sentences in every language. The rung 2 message names a technique: `technique`
 * holds its id, and the app reads the name and the definition from its catalogue.
 */
export type HintMessage = {
  readonly id: HintMessageId
  readonly values: Readonly<Record<string, HintValue>>
  /** Set on the rung 2 message only. */
  readonly technique?: TechniqueId
}

export function message(id: HintMessageId, values: Readonly<Record<string, HintValue>> = {}): HintMessage {
  return { id, values }
}

export const cell = (index: number): HintPart => ({ kind: 'cell', cell: index })
export const cells = (indexes: readonly number[]): HintPart => ({ kind: 'cells', cells: indexes })
export const unit = (index: number): HintPart => ({ kind: 'unit', unit: index })
export const units = (indexes: readonly number[]): HintPart => ({ kind: 'units', units: indexes })
export const cellsIn = (within: number, indexes: readonly number[]): HintPart => ({
  kind: 'cellsIn',
  unit: within,
  cells: indexes,
})
export const lines = (indexes: readonly number[]): HintPart => ({ kind: 'lines', units: indexes })
export const digits = (list: readonly number[], joiner: 'and' | 'or' = 'and'): HintPart => ({
  kind: 'digits',
  digits: list,
  joiner,
})
