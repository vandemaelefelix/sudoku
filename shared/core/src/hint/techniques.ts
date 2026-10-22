import { sortedUnique } from '../technique/masks'
import { TECHNIQUE_ORDER } from '../technique/order'
import type { Step, TechniqueId, TechniqueRank } from '../technique/types'
import { sees } from '../technique/sight'
import { BOX_OF, COL_OF, ROW_OF, UNITS, unitKindOf } from '../units'
import { cell, cells, cellsIn, digits, type HintMessage, type HintPart, lines, message, unit, units } from './message'

/**
 * The card messages of one technique. `later` is true when earlier steps of the plan removed
 * candidates, so the board alone no longer explains the step. The name and the definition of rung 2 are in the catalogues of
 * the app, under `technique.<id>.name` and `technique.<id>.definition` (ADR-033).
 */
export type HintTechnique = {
  readonly look: (step: Step) => HintMessage
  readonly why: (step: Step, later: boolean) => HintMessage
  readonly answer: (step: Step) => HintMessage
}

function placed(step: Step): { cell: HintPart; digit: number } {
  const { cell: index, digit } = step.placements[0]!
  return { cell: cell(index), digit }
}

function put(step: Step): HintMessage {
  return message('hint.put', placed(step))
}

function removedDigits(step: Step): HintPart {
  return digits(sortedUnique(step.eliminations.map((item) => item.digit)))
}

const focus = (step: Step): HintPart => unit(step.units[0]!)
const second = (step: Step): HintPart => unit(step.units[1]!)

const lookAtFocus = (step: Step): HintMessage => message('hint.look.unit', { unit: focus(step) })
const lookWhereDigit = (step: Step, place: HintPart): HintMessage =>
  message('hint.look.digitIn', { digit: step.digits[0]!, place })

type Size = 'two' | 'three' | 'four'

const NAKED_WHY = { two: 'hint.nakedPair.why', three: 'hint.nakedTriple.why', four: 'hint.nakedQuad.why' } as const
const HIDDEN_WHY = { two: 'hint.hiddenPair.why', three: 'hint.hiddenTriple.why', four: 'hint.hiddenQuad.why' } as const

function nakedSubset(size: Size): HintTechnique {
  return {
    look: lookAtFocus,
    why: (step) =>
      message(NAKED_WHY[size], {
        unit: focus(step),
        cells: cellsIn(step.units[0]!, step.pattern),
        digits: digits(step.digits),
      }),
    answer: (step) => message('hint.nakedSubset.answer', { digits: removedDigits(step), units: units(step.units) }),
  }
}

function hiddenSubset(size: Size): HintTechnique {
  return {
    look: lookAtFocus,
    why: (step) =>
      message(HIDDEN_WHY[size], {
        unit: focus(step),
        digits: digits(step.digits),
        cells: cellsIn(step.units[0]!, step.pattern),
      }),
    answer: (step) => message('hint.hiddenSubset.answer', { digits: removedDigits(step), cells: cells(step.pattern) }),
  }
}

/** The units of a fish: `count` base lines, then `count` cover lines. */
function fish(count: 2 | 3 | 4): HintTechnique {
  const bases = (step: Step): HintPart => lines(step.units.slice(0, count))
  const covers = (step: Step): HintPart => lines(step.units.slice(count))
  return {
    look: (step) => lookWhereDigit(step, bases(step)),
    why: (step) => message('hint.fish.why', { digit: step.digits[0]!, bases: bases(step), covers: covers(step) }),
    answer: (step) =>
      message('hint.removeOutside', { digit: step.digits[0]!, from: covers(step), outside: bases(step) }),
  }
}

function removedSeeingBoth(step: Step, a: number, b: number): HintMessage {
  return message('hint.removeSeeingBoth', { digit: step.digits[0]!, a: cell(a), b: cell(b) })
}

/** Two strong links, as two pairs of cells, and the unit or line that joins one end of each. */
type Links = { lines: HintPart; joint: HintPart; far: readonly [number, number] }

/** A skyscraper: two parallel lines, whose near ends share a crossing line. */
function skyscraperLinks(step: Step): Links {
  const [first, other] = step.units as [number, number]
  const crossOf = unitKindOf(first) === 'row' ? COL_OF : ROW_OF
  const ends = (index: number) => step.pattern.filter((pattern) => UNITS[index]!.includes(pattern))
  const firstEnds = ends(first)
  const otherEnds = ends(other)
  const cross = firstEnds
    .map((end) => crossOf[end]!)
    .find((line) => otherEnds.some((end) => crossOf[end] === line))!
  const farOf = (list: readonly number[]) => list.find((end) => crossOf[end] !== cross)!
  const crossUnit = crossOf === COL_OF ? 9 + cross : cross
  return { lines: lines([first, other]), joint: unit(crossUnit), far: [farOf(firstEnds), farOf(otherEnds)] }
}

/**
 * A 2-string kite: the units are the row, the column and the box of their near ends. Both ends of
 * one link can lie in that box, so the far ends are the pair that every elimination sees.
 */
function kiteLinks(step: Step): Links {
  const [row, column, box] = step.units as [number, number, number]
  const ends = (index: number) => step.pattern.filter((pattern) => UNITS[index]!.includes(pattern))
  const inBox = (end: number) => BOX_OF[end] === box - 18
  const pairs = ends(row).flatMap((rowFar, i) =>
    ends(column).flatMap((columnFar, j) => {
      const near = [ends(row)[1 - i]!, ends(column)[1 - j]!]
      return near.every(inBox) ? [[rowFar, columnFar] as const] : []
    }),
  )
  const far = pairs.find((pair) => step.eliminations.every((item) => pair.every((end) => sees(end, item.cell))))!
  return { lines: units([row, column]), joint: unit(box), far }
}

function linkedPair(links: (step: Step) => Links): HintTechnique {
  return {
    look: (step) => lookWhereDigit(step, links(step).lines),
    why: (step) => {
      const { lines: linked, joint, far } = links(step)
      return message('hint.linkedPair.why', {
        lines: linked,
        digit: step.digits[0]!,
        joint,
        a: cell(far[0]),
        b: cell(far[1]),
      })
    },
    answer: (step) => {
      const [a, b] = links(step).far
      return removedSeeingBoth(step, a, b)
    },
  }
}

/** The pattern of an XY-wing or XYZ-wing is the pivot, then the two pincers. Its digits start with the removed one. */
function pivotWing(pivotDigits: 'two' | 'three'): HintTechnique {
  const two = pivotDigits === 'two'
  return {
    look: (step) => message(two ? 'hint.xyWing.look' : 'hint.xyzWing.look', { cell: cell(step.pattern[0]!) }),
    why: (step) => {
      const [pivot, a, b] = step.pattern as [number, number, number]
      const [shared, ...others] = step.digits
      return message(two ? 'hint.xyWing.why' : 'hint.xyzWing.why', {
        pivot: cell(pivot),
        digits: digits(two ? others : sortedUnique(step.digits), 'or'),
        shared: shared!,
        a: cell(a),
        b: cell(b),
      })
    },
    answer: (step) => {
      const [, a, b] = step.pattern as [number, number, number]
      return two ? removedSeeingBoth(step, a, b) : message('hint.removeSeeingAll', { digit: step.digits[0]! })
    },
  }
}

/** The pattern of a W-wing is the two cells, then the link end that sees the first cell, then the other end. */
const wWing: HintTechnique = {
  look: (step) => message('hint.wWing.look', { a: cell(step.pattern[0]!), b: cell(step.pattern[1]!) }),
  why: (step) => {
    const [a, b, endA, endB] = step.pattern as [number, number, number, number]
    const [removed, linked] = step.digits as [number, number]
    const link = step.units[0]!
    return message('hint.wWing.why', {
      link: unit(link),
      linked,
      ends: cellsIn(link, [endA, endB]),
      a: cell(a),
      b: cell(b),
      removed,
    })
  },
  answer: (step) => removedSeeingBoth(step, step.pattern[0]!, step.pattern[1]!),
}

/**
 * The techniques that a hint can teach, with their messages. The planner uses no other technique, so a
 * technique without messages never reaches the card. Tier 1 and tier 2 of ADR-032 point 12. Tier 3 has none.
 */
export const HINT_TECHNIQUES: Readonly<Partial<Record<TechniqueId, HintTechnique>>> = {
  fullHouse: {
    look: (step) => message('hint.fullHouse.look', { unit: focus(step) }),
    why: (step) => message('hint.fullHouse.why', { unit: focus(step), digit: placed(step).digit }),
    answer: put,
  },
  hiddenSingle: {
    look: lookAtFocus,
    why: (step, later) =>
      message(later ? 'hint.hiddenSingle.whyLater' : 'hint.hiddenSingle.why', { unit: focus(step), ...placed(step) }),
    answer: put,
  },
  nakedSingle: {
    look: (step) => message('hint.look.cell', { cell: placed(step).cell }),
    why: (step, later) =>
      message(later ? 'hint.nakedSingle.whyLater' : 'hint.nakedSingle.why', { digit: placed(step).digit }),
    answer: put,
  },
  pointing: {
    look: (step) => lookWhereDigit(step, focus(step)),
    why: (step) => message('hint.pointing.why', { unit: focus(step), digit: step.digits[0]!, second: second(step) }),
    answer: (step) =>
      message('hint.removeOutside', { digit: step.digits[0]!, from: second(step), outside: focus(step) }),
  },
  boxLine: {
    look: (step) => lookWhereDigit(step, focus(step)),
    why: (step) => message('hint.boxLine.why', { unit: focus(step), digit: step.digits[0]!, second: second(step) }),
    answer: (step) =>
      message('hint.removeOutside', { digit: step.digits[0]!, from: second(step), outside: focus(step) }),
  },
  nakedPair: nakedSubset('two'),
  nakedTriple: nakedSubset('three'),
  hiddenPair: hiddenSubset('two'),
  hiddenTriple: hiddenSubset('three'),
  nakedQuad: nakedSubset('four'),
  hiddenQuad: hiddenSubset('four'),
  xWing: fish(2),
  swordfish: fish(3),
  jellyfish: fish(4),
  skyscraper: linkedPair(skyscraperLinks),
  twoStringKite: linkedPair(kiteLinks),
  xyWing: pivotWing('two'),
  xyzWing: pivotWing('three'),
  wWing,
}

/** The techniques with hint messages, in the order of TECHNIQUE_ORDER. The app has a name and a definition for each one. */
export const HINT_TECHNIQUE_IDS = [
  'fullHouse',
  'hiddenSingle',
  'nakedSingle',
  'pointing',
  'boxLine',
  'nakedPair',
  'nakedTriple',
  'hiddenPair',
  'hiddenTriple',
  'nakedQuad',
  'hiddenQuad',
  'xWing',
  'swordfish',
  'jellyfish',
  'skyscraper',
  'twoStringKite',
  'xyWing',
  'xyzWing',
  'wWing',
] as const satisfies readonly TechniqueId[]

export type HintTechniqueId = (typeof HINT_TECHNIQUE_IDS)[number]

/** The ranks of `TECHNIQUE_ORDER` that have hint messages, in the same order. */
export const HINT_ORDER: readonly TechniqueRank[] = TECHNIQUE_ORDER.filter(
  (rank) => HINT_TECHNIQUES[rank.technique] !== undefined,
)
