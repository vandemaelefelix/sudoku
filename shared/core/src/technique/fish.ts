import { bitCount } from '../bits'
import type { Digit } from '../game/types'
import { COL_OF, ROW_OF, UNITS } from '../units'
import { eliminationStep } from './build'
import { bitOf, sortedUnique } from './masks'
import { placesOf } from './sight'
import type { Candidates, Step } from './types'

const ROW_UNITS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const COLUMN_UNITS = [9, 10, 11, 12, 13, 14, 15, 16, 17]

const ORIENTATIONS = [
  { bases: ROW_UNITS, covers: COLUMN_UNITS, coverOf: COL_OF },
  { bases: COLUMN_UNITS, covers: ROW_UNITS, coverOf: ROW_OF },
] as const

const FISH_NAMES: Readonly<Record<2 | 3 | 4, 'xWing' | 'swordfish' | 'jellyfish'>> = {
  2: 'xWing',
  3: 'swordfish',
  4: 'jellyfish',
}

type Line = { unit: number; cells: number[]; cover: number }

/**
 * `size` base lines hold a digit in `size` cover lines only, and each base line holds it twice at
 * least. The digit then leaves the cover lines outside the base lines. A base line with one cell
 * is a hidden single, so it stays with its own technique. Rows as base lines and columns as base
 * lines are two searches. The units are the base lines, then the cover lines. The pattern is the
 * fish cells.
 */
export function findFish(candidates: Candidates, board: readonly number[], size: 2 | 3 | 4): Step[] {
  const steps: Step[] = []
  for (let digit = 1; digit <= 9; digit++) {
    for (const { bases, covers, coverOf } of ORIENTATIONS) {
      const lines: Line[] = []
      for (const unit of bases) {
        const cells = placesOf(candidates, board, unit, digit)
        if (cells.length < 2 || cells.length > size) continue
        lines.push({ unit, cells, cover: cells.reduce((mask, cell) => mask | (1 << coverOf[cell]!), 0) })
      }
      const chosen: Line[] = []
      const pick = (start: number, union: number): void => {
        if (chosen.length === size) {
          if (bitCount(union) !== size) return
          const step = fishStep(candidates, digit as Digit, size, chosen, union, covers)
          if (step) steps.push(step)
          return
        }
        for (let i = start; i < lines.length; i++) {
          const next = union | lines[i]!.cover
          if (bitCount(next) > size) continue
          chosen.push(lines[i]!)
          pick(i + 1, next)
          chosen.pop()
        }
      }
      pick(0, 0)
    }
  }
  return steps
}

function fishStep(
  candidates: Candidates,
  digit: Digit,
  size: 2 | 3 | 4,
  lines: readonly Line[],
  union: number,
  covers: readonly number[],
): Step | undefined {
  const cells = sortedUnique(lines.flatMap((line) => line.cells))
  const coverUnits = covers.filter((_, index) => union & (1 << index))
  const eliminations = coverUnits.flatMap((unit) =>
    UNITS[unit]!.filter((cell) => candidates[cell]! & bitOf(digit) && !cells.includes(cell)).map((cell) => ({
      cell,
      digit,
    })),
  )
  if (eliminations.length === 0) return undefined
  return eliminationStep(
    FISH_NAMES[size],
    [...lines.map((line) => line.unit), ...coverUnits],
    cells,
    [digit],
    eliminations,
  )
}
