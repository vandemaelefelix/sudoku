import type { Digit } from '../game/types'
import { BOX_OF, COL_OF, ROW_OF } from '../units'
import { eliminationStep } from './build'
import { candidatesSeeing, placesOf } from './sight'
import { sortedUnique } from './masks'
import type { Candidates, Step } from './types'

/** A strong link: a unit where the digit has two cells. One of them holds the digit. */
type Link = { unit: number; ends: [number, number] }

const ROW_UNITS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const COLUMN_UNITS = [9, 10, 11, 12, 13, 14, 15, 16, 17]

function linksOf(candidates: Candidates, board: readonly number[], units: readonly number[], digit: number): Link[] {
  return units.flatMap((unit) => {
    const ends = placesOf(candidates, board, unit, digit)
    return ends.length === 2 ? [{ unit, ends: ends as [number, number] }] : []
  })
}

/**
 * Two strong links in parallel lines have one end in the same crossing line. Their other two ends
 * are not in one line. One of those two ends holds the digit, so the digit leaves every cell
 * that sees both. The units are the two links. The pattern is the four link cells.
 */
export function findSkyscrapers(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  const orientations = [
    { units: ROW_UNITS, crossOf: COL_OF },
    { units: COLUMN_UNITS, crossOf: ROW_OF },
  ]
  for (let digit = 1; digit <= 9; digit++) {
    for (const { units, crossOf } of orientations) {
      const links = linksOf(candidates, board, units, digit)
      for (const [index, first] of links.entries()) {
        for (const second of links.slice(index + 1)) {
          const shared = first.ends.filter((a) => second.ends.some((b) => crossOf[a] === crossOf[b]))
          if (shared.length !== 1) continue
          const sharedCross = crossOf[shared[0]!]
          const a = first.ends.find((end) => crossOf[end] !== sharedCross)!
          const b = second.ends.find((end) => crossOf[end] !== sharedCross)!
          const eliminations = candidatesSeeing(candidates, digit, [a, b])
          if (eliminations.length === 0) continue
          steps.push(
            eliminationStep(
              'skyscraper',
              [first.unit, second.unit],
              sortedUnique([...first.ends, ...second.ends]),
              [digit as Digit],
              eliminations,
            ),
          )
        }
      }
    }
  }
  return steps
}

/**
 * A strong link in a row and one in a column have ends in the same box. Those two ends cannot both
 * hold the digit, so one of the two far ends does. The digit leaves every cell that sees both far
 * ends. The units are the row, the column and the box. The pattern is the four link cells.
 */
export function findTwoStringKites(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  for (let digit = 1; digit <= 9; digit++) {
    const columns = linksOf(candidates, board, COLUMN_UNITS, digit)
    for (const row of linksOf(candidates, board, ROW_UNITS, digit)) {
      for (const column of columns) {
        const cells = sortedUnique([...row.ends, ...column.ends])
        if (cells.length !== 4) continue
        for (const [rowEnd, rowFar] of [row.ends, [row.ends[1], row.ends[0]] as const]) {
          for (const [columnEnd, columnFar] of [column.ends, [column.ends[1], column.ends[0]] as const]) {
            if (BOX_OF[rowEnd] !== BOX_OF[columnEnd]) continue
            const eliminations = candidatesSeeing(candidates, digit, [rowFar, columnFar])
            if (eliminations.length === 0) continue
            steps.push(
              eliminationStep(
                'twoStringKite',
                [row.unit, column.unit, 18 + BOX_OF[rowEnd]!],
                cells,
                [digit as Digit],
                eliminations,
              ),
            )
          }
        }
      }
    }
  }
  return steps
}
