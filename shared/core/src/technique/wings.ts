import { bitCount } from '../bits'
import type { Digit } from '../game/types'
import { UNITS } from '../units'
import { eliminationStep } from './build'
import { bitOf, digitsOf } from './masks'
import { candidatesSeeing, sees, sharedUnit } from './sight'
import type { Candidates, Step } from './types'

function cellsWithCount(candidates: Candidates, board: readonly number[], count: number): number[] {
  const cells: number[] = []
  for (let cell = 0; cell < candidates.length; cell++) {
    if (board[cell] === 0 && bitCount(candidates[cell]!) === count) cells.push(cell)
  }
  return cells
}

/**
 * The digits of a wing step: the digit that the step removes first, then the other digits of the
 * pattern, ascending. The hint text needs the removed digit at a known place.
 */
function removedFirst(removed: number, others: readonly number[]): Digit[] {
  return [removed, ...others.filter((digit) => digit !== removed)] as Digit[]
}

/**
 * The pivot has two digits (XY-wing) or three (XYZ-wing). Two pincers with two digits each see the
 * pivot. The pincers share one digit z and hold the pivot digits between them. Whichever way the
 * pivot goes, a pincer holds z. So z leaves every cell that sees both pincers. With three pivot
 * digits, the pivot may hold z itself. So z leaves only the cells that also see the pivot.
 * The pattern is the pivot, then the pincers by cell. The units join the pivot to each pincer.
 * A pincer in the same unit as the other one adds no second unit.
 */
function findPivotWings(candidates: Candidates, board: readonly number[], pivotSize: 2 | 3): Step[] {
  const steps: Step[] = []
  const bivalue = cellsWithCount(candidates, board, 2)
  for (const pivot of cellsWithCount(candidates, board, pivotSize)) {
    const pivotMask = candidates[pivot]!
    const reach = bivalue.filter((cell) => sees(pivot, cell))
    for (const [index, a] of reach.entries()) {
      for (const b of reach.slice(index + 1)) {
        const maskA = candidates[a]!
        const maskB = candidates[b]!
        const common = maskA & maskB
        if (bitCount(common) !== 1) continue
        if (
          pivotSize === 2
            ? pivotMask & common || (maskA | maskB) !== (pivotMask | common)
            : (maskA | maskB) !== pivotMask
        ) {
          continue
        }
        const digit = digitsOf(common)[0]!
        const eliminations = candidatesSeeing(candidates, digit, pivotSize === 2 ? [a, b] : [pivot, a, b])
        if (eliminations.length === 0) continue
        steps.push(
          eliminationStep(
            pivotSize === 2 ? 'xyWing' : 'xyzWing',
            [...new Set([sharedUnit(pivot, a)!, sharedUnit(pivot, b)!])],
            [pivot, a, b],
            removedFirst(digit, digitsOf(pivotMask | common)),
            eliminations,
          ),
        )
      }
    }
  }
  return steps
}

export function findXyWings(candidates: Candidates, board: readonly number[]): Step[] {
  return findPivotWings(candidates, board, 2)
}

export function findXyzWings(candidates: Candidates, board: readonly number[]): Step[] {
  return findPivotWings(candidates, board, 3)
}

/**
 * Two cells with the same two digits x and y do not see each other. A strong link on x joins them:
 * each end of the link sees one of the two cells. One of the two cells holds y, so y leaves every
 * cell that sees both. A link with the same two ends in two units is one step, from the first unit.
 * The pattern is the two cells, then the link end that sees the first cell, then the other end.
 * The units are the link, then the units that join each end to its cell.
 */
export function findWWings(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  const bivalue = cellsWithCount(candidates, board, 2)
  for (const [index, a] of bivalue.entries()) {
    for (const b of bivalue.slice(index + 1)) {
      const mask = candidates[a]!
      if (candidates[b] !== mask || sees(a, b)) continue
      const [low, high] = digitsOf(mask) as [Digit, Digit]
      for (const [linked, other] of [
        [low, high],
        [high, low],
      ] as const) {
        const eliminations = candidatesSeeing(candidates, other, [a, b])
        if (eliminations.length === 0) continue
        const done = new Set<string>()
        for (const [unit, cells] of UNITS.entries()) {
          if (cells.some((cell) => board[cell] === linked)) continue
          const ends = cells.filter((cell) => candidates[cell]! & bitOf(linked))
          if (ends.length !== 2 || ends.includes(a) || ends.includes(b) || done.has(ends.join())) continue
          const [first, second] = ends as [number, number]
          const forward = sees(first, a) && sees(second, b)
          const backward = sees(first, b) && sees(second, a)
          if (!forward && !backward) continue
          done.add(ends.join())
          const [endA, endB] = forward ? [first, second] : [second, first]
          steps.push(
            eliminationStep(
              'wWing',
              [...new Set([unit, sharedUnit(a, endA)!, sharedUnit(b, endB)!])],
              [a, b, endA, endB],
              removedFirst(other, [low, high]),
              eliminations,
            ),
          )
        }
      }
    }
  }
  return steps
}
