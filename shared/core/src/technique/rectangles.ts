import { bitCount } from '../bits'
import { BOX_OF } from '../units'
import { eliminationStep } from './build'
import { digitsOf } from './masks'
import type { Candidates, Step } from './types'

const RECTANGLES: readonly (readonly number[])[] = (() => {
  const result: number[][] = []
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2]
          if (new Set(cells.map((cell) => BOX_OF[cell])).size === 2) result.push(cells)
        }
      }
    }
  }
  return result
})()

/**
 * Valid only for a puzzle with exactly one solution. Four cells lie in two rows, two columns and two
 * boxes. Three of them hold the same two digits only. If the fourth cell held one of the two digits,
 * the pairs could swap and the puzzle would have two solutions. So the fourth cell loses both digits.
 * The units are the box of the fourth cell, then the box of the three other cells. The pattern is
 * the four cells. The digits are the pair.
 */
export function findUniqueRectangles(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  for (const cells of RECTANGLES) {
    if (cells.some((cell) => board[cell] !== 0)) continue
    const masks = cells.map((cell) => candidates[cell]!)
    for (const [index, mask] of masks.entries()) {
      const others = masks.filter((_, other) => other !== index)
      const pair = others[0]!
      if (bitCount(mask) < 3 || bitCount(pair) !== 2 || others.some((other) => other !== pair)) continue
      if ((mask & pair) !== pair) continue
      const target = cells[index]!
      const floor = cells.find((cell) => BOX_OF[cell] !== BOX_OF[target])!
      steps.push(
        eliminationStep(
          'uniqueRectangle',
          [18 + BOX_OF[target]!, 18 + BOX_OF[floor]!],
          cells,
          digitsOf(pair),
          digitsOf(pair).map((digit) => ({ cell: target, digit })),
        ),
      )
    }
  }
  return steps
}
