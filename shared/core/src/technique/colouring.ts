import type { Digit } from '../game/types'
import { UNITS } from '../units'
import { eliminationStep } from './build'
import { sortedUnique } from './masks'
import { placesOf, sees } from './sight'
import type { Candidates, CellDigit, Step } from './types'

type Edge = { cell: number; unit: number }

/**
 * The strong links of one digit join its cells into groups. Two colours split a group: the two cells
 * of a link always differ, and exactly one colour holds the digit.
 * Colour wrap: two cells of one colour see each other, so that colour is false and the digit leaves
 * all its cells. Colour trap: a cell outside the group sees a cell of each colour, so the digit
 * leaves it. A group gives one step, the wrap when there is one. A group of one link gives nothing
 * that an easier technique does not. The units are the units of the links, the first one found first.
 * The pattern is the cells of the group. The groups are the two colours.
 */
export function findSimpleColouring(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  for (let digit = 1; digit <= 9; digit++) {
    const edges: Edge[][] = Array.from({ length: candidates.length }, () => [])
    for (const [unit] of UNITS.entries()) {
      const ends = placesOf(candidates, board, unit, digit)
      if (ends.length !== 2) continue
      edges[ends[0]!]!.push({ cell: ends[1]!, unit })
      edges[ends[1]!]!.push({ cell: ends[0]!, unit })
    }
    const colour = new Int8Array(candidates.length).fill(-1)
    for (let start = 0; start < candidates.length; start++) {
      if (colour[start] !== -1 || edges[start]!.length === 0) continue
      const members = [start]
      const units = new Set<number>()
      colour[start] = 0
      for (let head = 0; head < members.length; head++) {
        const cell = members[head]!
        for (const { cell: next, unit } of edges[cell]!) {
          units.add(unit)
          if (colour[next] !== -1) continue
          colour[next] = 1 - colour[cell]!
          members.push(next)
        }
      }
      if (members.length < 3) continue
      const groups = [0, 1].map((side) => sortedUnique(members.filter((cell) => colour[cell] === side)))
      const wrapped = wrap(digit as Digit, groups)
      const eliminations = wrapped.length > 0 ? wrapped : trap(candidates, digit as Digit, members, groups)
      if (eliminations.length === 0) continue
      steps.push(
        eliminationStep('simpleColouring', [...units], sortedUnique(members), [digit as Digit], eliminations, {
          groups,
        }),
      )
    }
  }
  return steps
}

function wrap(digit: Digit, groups: readonly (readonly number[])[]): CellDigit[] {
  const clash = groups.find((cells) => cells.some((a, index) => cells.slice(index + 1).some((b) => sees(a, b))))
  return clash ? clash.map((cell) => ({ cell, digit })) : []
}

function trap(
  candidates: Candidates,
  digit: Digit,
  members: readonly number[],
  groups: readonly (readonly number[])[],
): CellDigit[] {
  const found: CellDigit[] = []
  for (let cell = 0; cell < candidates.length; cell++) {
    if (!(candidates[cell]! & (1 << (digit - 1))) || members.includes(cell)) continue
    if (groups.every((cells) => cells.some((other) => sees(cell, other)))) found.push({ cell, digit })
  }
  return found
}
