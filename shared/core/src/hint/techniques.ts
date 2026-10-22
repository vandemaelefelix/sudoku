import { sortedUnique } from '../technique/masks'
import { TECHNIQUE_ORDER } from '../technique/order'
import type { Step, TechniqueId, TechniqueRank } from '../technique/types'
import { capitalised, cellName, cellsIn, cellsName, listOf, unitName } from './names'

/**
 * The card text of one technique. `later` is true when earlier steps of the plan removed
 * candidates, so the board alone no longer explains the step.
 */
export type HintTechnique = {
  readonly name: string
  /** The one-line definition of rung 2. It follows the name and a colon, so it starts in lower case. */
  readonly definition: string
  readonly look: (step: Step) => string
  readonly why: (step: Step, later: boolean) => string
  readonly answer: (step: Step) => string
}

function placed(step: Step): { cell: string; digit: number } {
  const { cell, digit } = step.placements[0]!
  return { cell: cellName(cell), digit }
}

function put(step: Step): string {
  const { cell, digit } = placed(step)
  return `Put ${digit} in ${cell}.`
}

function removedDigits(step: Step): string {
  return listOf(sortedUnique(step.eliminations.map((item) => item.digit)))
}

const focus = (step: Step): string => unitName(step.units[0]!)
const second = (step: Step): string => unitName(step.units[1]!)

function nakedSubset(size: 'two' | 'three'): HintTechnique {
  const pair = size === 'two'
  return {
    name: pair ? 'Naked pair' : 'Naked triple',
    definition: pair
      ? 'two cells of a row, column or box that hold only the same two digits. The other cells there cannot hold them.'
      : 'three cells of a row, column or box that hold only three digits between them. The other cells there cannot hold them.',
    look: (step) => `Look at ${focus(step)}.`,
    why: (step) =>
      `In ${focus(step)}, ${cellsIn(step.units[0]!, step.pattern)} can hold only ${listOf(step.digits)}${pair ? '' : ' between them'}. ` +
      `So these ${size} digits must go in these ${size} cells.`,
    answer: (step) => `Remove ${removedDigits(step)} from the other cells of ${listOf(step.units.map(unitName))}.`,
  }
}

function hiddenSubset(size: 'two' | 'three'): HintTechnique {
  const pair = size === 'two'
  return {
    name: pair ? 'Hidden pair' : 'Hidden triple',
    definition: `${size} digits that fit in only ${size} cells of a row, column or box. Those cells can hold no other digit.`,
    look: (step) => `Look at ${focus(step)}.`,
    why: (step) =>
      `In ${focus(step)}, ${listOf(step.digits)} fit only in ${cellsIn(step.units[0]!, step.pattern)}. ` +
      `So these ${size} cells can hold no other digit.`,
    answer: (step) => `Remove ${removedDigits(step)} from ${cellsName(step.pattern)}.`,
  }
}

/**
 * The techniques that a hint can teach, with their text. The planner uses no other technique, so a
 * technique without text never reaches the card. The tier 1 techniques of ADR-032 point 12.
 */
export const HINT_TECHNIQUES: Readonly<Partial<Record<TechniqueId, HintTechnique>>> = {
  fullHouse: {
    name: 'Full house',
    definition: 'a row, column or box with one empty cell. That cell gets the missing digit.',
    look: (step) => `Look at ${focus(step)}. It has one empty cell.`,
    why: (step) => {
      const { digit } = placed(step)
      return `${capitalised(focus(step))} holds every digit but ${digit}. So ${digit} goes in its empty cell.`
    },
    answer: put,
  },
  hiddenSingle: {
    name: 'Hidden single',
    definition: 'a digit that fits in only one cell of a row, column or box.',
    look: (step) => `Look at ${focus(step)}.`,
    why: (step, later) => {
      const { cell, digit } = placed(step)
      const others = later
        ? `Every other empty cell has a ${digit} in its row, column or box, or lost it in a step before.`
        : `Every other empty cell has a ${digit} in its row, column or box.`
      return `In ${focus(step)}, a ${digit} fits only in ${cell}. ${others}`
    },
    answer: put,
  },
  nakedSingle: {
    name: 'Naked single',
    definition: 'a cell where only one digit fits.',
    look: (step) => `Look at ${placed(step).cell}.`,
    why: (step, later) => {
      const { digit } = placed(step)
      return later
        ? `Its row, column and box hold the other digits, or a step before removed them. So only ${digit} fits.`
        : `Its row, column and box hold every digit but ${digit}. So only ${digit} fits.`
    },
    answer: put,
  },
  pointing: {
    name: 'Pointing',
    definition:
      'a digit that fits in only one row or column of a box. That row or column loses the digit outside the box.',
    look: (step) => `Look where a ${step.digits[0]} fits in ${focus(step)}.`,
    why: (step) => {
      const digit = step.digits[0]
      return `In ${focus(step)}, a ${digit} fits only in ${second(step)}. So the ${digit} of ${second(step)} must be in this box.`
    },
    answer: (step) => `Remove ${step.digits[0]} from ${second(step)}, outside ${focus(step)}.`,
  },
  boxLine: {
    name: 'Box-line reduction',
    definition:
      'a digit that fits in only one box of a row or column. That box loses the digit outside the row or column.',
    look: (step) => `Look where a ${step.digits[0]} fits in ${focus(step)}.`,
    why: (step) => {
      const digit = step.digits[0]
      return `In ${focus(step)}, a ${digit} fits only in ${second(step)}. So the ${digit} of ${second(step)} must be in ${focus(step)}.`
    },
    answer: (step) => `Remove ${step.digits[0]} from ${second(step)}, outside ${focus(step)}.`,
  },
  nakedPair: nakedSubset('two'),
  nakedTriple: nakedSubset('three'),
  hiddenPair: hiddenSubset('two'),
  hiddenTriple: hiddenSubset('three'),
}

/** The ranks of `TECHNIQUE_ORDER` that have hint text, in the same order. */
export const HINT_ORDER: readonly TechniqueRank[] = TECHNIQUE_ORDER.filter(
  (rank) => HINT_TECHNIQUES[rank.technique] !== undefined,
)
