import { sortedUnique } from '../technique/masks'
import { TECHNIQUE_ORDER } from '../technique/order'
import type { Step, TechniqueId, TechniqueRank } from '../technique/types'
import { sees } from '../technique/sight'
import { BOX_OF, COL_OF, ROW_OF, UNITS, unitKindOf } from '../units'
import { aDigit, capitalised, cellName, cellsIn, cellsName, linesName, listOf, unitName } from './names'

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

type Size = 'two' | 'three' | 'four'

const SUBSET_NAMES: Readonly<Record<Size, string>> = { two: 'pair', three: 'triple', four: 'quad' }

function nakedSubset(size: Size): HintTechnique {
  const pair = size === 'two'
  return {
    name: `Naked ${SUBSET_NAMES[size]}`,
    definition: pair
      ? 'two cells of a row, column or box that hold only the same two digits. The other cells there cannot hold them.'
      : `${size} cells of a row, column or box that hold only ${size} digits between them. The other cells there cannot hold them.`,
    look: (step) => `Look at ${focus(step)}.`,
    why: (step) =>
      `In ${focus(step)}, ${cellsIn(step.units[0]!, step.pattern)} can hold only ${listOf(step.digits)}${pair ? '' : ' between them'}. ` +
      `So these ${size} digits must go in these ${size} cells.`,
    answer: (step) => `Remove ${removedDigits(step)} from the other cells of ${listOf(step.units.map(unitName))}.`,
  }
}

function hiddenSubset(size: Size): HintTechnique {
  return {
    name: `Hidden ${SUBSET_NAMES[size]}`,
    definition: `${size} digits that fit in only ${size} cells of a row, column or box. Those cells can hold no other digit.`,
    look: (step) => `Look at ${focus(step)}.`,
    why: (step) =>
      `In ${focus(step)}, ${listOf(step.digits)} fit only in ${cellsIn(step.units[0]!, step.pattern)}. ` +
      `So these ${size} cells can hold no other digit.`,
    answer: (step) => `Remove ${removedDigits(step)} from ${cellsName(step.pattern)}.`,
  }
}

/** The units of a fish: `size` base lines, then `size` cover lines. */
function fish(name: string, size: 'two' | 'three' | 'four'): HintTechnique {
  const count = { two: 2, three: 3, four: 4 }[size]
  const bases = (step: Step): string => linesName(step.units.slice(0, count))
  const covers = (step: Step): string => linesName(step.units.slice(count))
  return {
    name,
    definition:
      `${size} rows where a digit fits only in the same ${size} columns. ` +
      'Those columns then lose the digit in the other rows (or the same with rows and columns swapped).',
    look: (step) => `Look where ${aDigit(step.digits[0]!)} fits in ${bases(step)}.`,
    why: (step) => {
      const digit = step.digits[0]!
      return (
        `In ${bases(step)}, ${aDigit(digit)} fits only in ${covers(step)}. ` +
        `So ${covers(step)} must hold their ${digit}s in ${bases(step)}.`
      )
    },
    answer: (step) => `Remove ${step.digits[0]} from ${covers(step)}, outside ${bases(step)}.`,
  }
}

function removedSeeing(step: Step, cells: string): string {
  return `Remove ${step.digits[0]} from the cells that share a row, column or box with ${cells}.`
}

/** Two strong links, as two pairs of cells, and the unit or line that joins one end of each. */
type Links = { lines: string; joint: string; far: readonly [number, number] }

/** A skyscraper: two parallel lines, whose near ends share a crossing line. */
function skyscraperLinks(step: Step): Links {
  const [first, other] = step.units as [number, number]
  const crossOf = unitKindOf(first) === 'row' ? COL_OF : ROW_OF
  const ends = (unit: number) => step.pattern.filter((cell) => UNITS[unit]!.includes(cell))
  const firstEnds = ends(first)
  const otherEnds = ends(other)
  const cross = firstEnds
    .map((cell) => crossOf[cell]!)
    .find((line) => otherEnds.some((cell) => crossOf[cell] === line))!
  const farOf = (cells: readonly number[]) => cells.find((cell) => crossOf[cell] !== cross)!
  const crossUnit = crossOf === COL_OF ? 9 + cross : cross
  return { lines: linesName([first, other]), joint: unitName(crossUnit), far: [farOf(firstEnds), farOf(otherEnds)] }
}

/**
 * A 2-string kite: the units are the row, the column and the box of their near ends. Both ends of
 * one link can lie in that box, so the far ends are the pair that every elimination sees.
 */
function kiteLinks(step: Step): Links {
  const [row, column, box] = step.units as [number, number, number]
  const ends = (unit: number) => step.pattern.filter((cell) => UNITS[unit]!.includes(cell))
  const inBox = (cell: number) => BOX_OF[cell] === box - 18
  const pairs = ends(row).flatMap((rowFar, i) =>
    ends(column).flatMap((columnFar, j) => {
      const near = [ends(row)[1 - i]!, ends(column)[1 - j]!]
      return near.every(inBox) ? [[rowFar, columnFar] as const] : []
    }),
  )
  const far = pairs.find((pair) => step.eliminations.every(({ cell }) => pair.every((end) => sees(end, cell))))!
  return { lines: `${unitName(row)} and ${unitName(column)}`, joint: unitName(box), far }
}

function linkedPair(name: string, definition: string, links: (step: Step) => Links): HintTechnique {
  const farCells = (step: Step): string => {
    const [a, b] = links(step).far
    return `${cellName(a)} or ${cellName(b)}`
  }
  return {
    name,
    definition,
    look: (step) => `Look where ${aDigit(step.digits[0]!)} fits in ${links(step).lines}.`,
    why: (step) => {
      const { lines, joint } = links(step)
      const digit = step.digits[0]!
      return (
        `${capitalised(lines)} each have only two cells for ${aDigit(digit)}, and both have one in ${joint}. ` +
        `At most one of those holds the ${digit}, so ${farCells(step)} holds it.`
      )
    },
    answer: (step) => {
      const [a, b] = links(step).far
      return removedSeeing(step, `both ${cellName(a)} and ${cellName(b)}`)
    },
  }
}

/** The pattern of an XY-wing or XYZ-wing is the pivot, then the two pincers. Its digits start with the removed one. */
function pivotWing(name: string, definition: string, pivotDigits: 'two' | 'three'): HintTechnique {
  return {
    name,
    definition,
    look: (step) => `Look at ${cellName(step.pattern[0]!)}. It has only ${pivotDigits} digits.`,
    why: (step) => {
      const [pivot, a, b] = step.pattern as [number, number, number]
      const [shared, ...others] = step.digits
      const pivotHolds = pivotDigits === 'two' ? others : sortedUnique(step.digits)
      const places =
        pivotDigits === 'two' ? `${cellName(a)} or ${cellName(b)}` : `this cell, in ${cellName(a)} or in ${cellName(b)}`
      return `${capitalised(cellName(pivot))} holds ${listOf(pivotHolds, 'or')}. Each choice puts ${aDigit(shared!)} in ${places}.`
    },
    answer: (step) => {
      const [, a, b] = step.pattern as [number, number, number]
      return removedSeeing(
        step,
        pivotDigits === 'two' ? `both ${cellName(a)} and ${cellName(b)}` : 'all three of these cells',
      )
    },
  }
}

/** The pattern of a W-wing is the two cells, then the link end that sees the first cell, then the other end. */
const wWing: HintTechnique = {
  name: 'W-wing',
  definition:
    'two cells with the same two digits, linked by a row, column or box where one of the two digits fits in only two cells. ' +
    'One of the two cells must hold the other digit.',
  look: (step) =>
    `Look at ${cellName(step.pattern[0]!)} and ${cellName(step.pattern[1]!)}. They hold the same two digits.`,
  why: (step) => {
    const [a, b, endA, endB] = step.pattern as [number, number, number, number]
    const [removed, linked] = step.digits as [number, number]
    const link = step.units[0]!
    return (
      `In ${unitName(link)}, ${aDigit(linked)} fits only in ${cellsIn(link, [endA, endB])}, so one of them holds it. ` +
      `That cell rules out ${linked} in ${cellName(a)} or in ${cellName(b)}, so one of these holds ${removed}.`
    )
  },
  answer: (step) => removedSeeing(step, `both ${cellName(step.pattern[0]!)} and ${cellName(step.pattern[1]!)}`),
}

/**
 * The techniques that a hint can teach, with their text. The planner uses no other technique, so a
 * technique without text never reaches the card. Tier 1 and tier 2 of ADR-032 point 12. Tier 3 has no text.
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
        ? `Every other empty cell has ${aDigit(digit)} in its row, column or box, or an earlier step removed it.`
        : `Every other empty cell has ${aDigit(digit)} in its row, column or box.`
      return `In ${focus(step)}, ${aDigit(digit)} fits only in ${cell}. ${others}`
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
        ? `Its row, column and box hold the other digits, or earlier steps removed them. So only ${digit} fits.`
        : `Its row, column and box hold every digit but ${digit}. So only ${digit} fits.`
    },
    answer: put,
  },
  pointing: {
    name: 'Pointing',
    definition:
      'a digit that fits in only one row or column of a box. That row or column loses the digit outside the box.',
    look: (step) => `Look where ${aDigit(step.digits[0]!)} fits in ${focus(step)}.`,
    why: (step) => {
      const digit = step.digits[0]!
      return `In ${focus(step)}, ${aDigit(digit)} fits only in ${second(step)}. So the ${digit} of ${second(step)} must be in this box.`
    },
    answer: (step) => `Remove ${step.digits[0]} from ${second(step)}, outside ${focus(step)}.`,
  },
  boxLine: {
    name: 'Box-line reduction',
    definition:
      'a digit that fits in only one box of a row or column. That box loses the digit outside the row or column.',
    look: (step) => `Look where ${aDigit(step.digits[0]!)} fits in ${focus(step)}.`,
    why: (step) => {
      const digit = step.digits[0]!
      return `In ${focus(step)}, ${aDigit(digit)} fits only in ${second(step)}. So the ${digit} of ${second(step)} must be in ${focus(step)}.`
    },
    answer: (step) => `Remove ${step.digits[0]} from ${second(step)}, outside ${focus(step)}.`,
  },
  nakedPair: nakedSubset('two'),
  nakedTriple: nakedSubset('three'),
  hiddenPair: hiddenSubset('two'),
  hiddenTriple: hiddenSubset('three'),
  nakedQuad: nakedSubset('four'),
  hiddenQuad: hiddenSubset('four'),
  xWing: fish('X-wing', 'two'),
  swordfish: fish('Swordfish', 'three'),
  jellyfish: fish('Jellyfish', 'four'),
  skyscraper: linkedPair(
    'Skyscraper',
    'two rows or two columns where a digit fits in only two cells each, with one cell of each in the same line. ' +
      'One of the other two cells holds the digit.',
    skyscraperLinks,
  ),
  twoStringKite: linkedPair(
    'Two-string kite',
    'a row and a column where a digit fits in only two cells each, with one cell of each in the same box. ' +
      'One of the other two cells holds the digit.',
    kiteLinks,
  ),
  xyWing: pivotWing(
    'XY-wing',
    'a cell with two digits, and two cells in its row, column or box that each pair one of them with a third digit. ' +
      'One of the two cells must hold the third digit.',
    'two',
  ),
  xyzWing: pivotWing(
    'XYZ-wing',
    'a cell with three digits, and two cells in its row, column or box that each hold two of them, one shared. ' +
      'One of the three cells must hold the shared digit.',
    'three',
  ),
  wWing,
}

/** The ranks of `TECHNIQUE_ORDER` that have hint text, in the same order. */
export const HINT_ORDER: readonly TechniqueRank[] = TECHNIQUE_ORDER.filter(
  (rank) => HINT_TECHNIQUES[rank.technique] !== undefined,
)
