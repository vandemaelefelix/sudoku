import { bitCount } from '../bits'
import type { Digit } from '../game/types'
import { UNITS } from '../units'
import { eliminationStep } from './build'
import { bitOf, digitsOf, maskOf, sortedUnique } from './masks'
import type { Candidates, CellDigit, Step } from './types'

type Pattern = {
  technique: 'nakedPair' | 'nakedTriple' | 'hiddenPair' | 'hiddenTriple'
  units: number[]
  cells: number[]
  digits: Digit[]
  eliminations: Map<number, CellDigit>
}

/** Every combination of `size` items, in the order of `items`. */
function combinations<T>(items: readonly T[], size: number, start = 0, chosen: T[] = []): T[][] {
  if (chosen.length === size) return [chosen]
  const found: T[][] = []
  for (let i = start; i < items.length; i++) {
    found.push(...combinations(items, size, i + 1, [...chosen, items[i]!]))
  }
  return found
}

/**
 * The same cells and digits in two units are one pattern. Its eliminations are the eliminations of
 * both units, without duplicates.
 */
function collect(
  found: Map<string, Pattern>,
  technique: Pattern['technique'],
  unit: number,
  cells: readonly number[],
  digits: readonly Digit[],
  eliminations: readonly CellDigit[],
): void {
  if (eliminations.length === 0) return
  const key = `${cells.join(',')}/${digits.join(',')}`
  let pattern = found.get(key)
  if (!pattern) {
    pattern = { technique, units: [], cells: [...cells], digits: [...digits], eliminations: new Map() }
    found.set(key, pattern)
  }
  pattern.units.push(unit)
  for (const elimination of eliminations) {
    pattern.eliminations.set(elimination.cell * 10 + elimination.digit, elimination)
  }
}

function steps(found: Map<string, Pattern>): Step[] {
  return [...found.values()].map((pattern) =>
    eliminationStep(pattern.technique, pattern.units, pattern.cells, pattern.digits, [
      ...pattern.eliminations.values(),
    ]),
  )
}

/**
 * `size` empty cells of a unit that hold only `size` digits between them. A subset that contains a
 * smaller subset is skipped, so each pattern has one name.
 */
export function findNakedSubsets(candidates: Candidates, board: readonly number[], size: 2 | 3): Step[] {
  const found = new Map<string, Pattern>()
  for (const [unit, unitCells] of UNITS.entries()) {
    const empty = unitCells.filter((cell) => board[cell] === 0 && bitCount(candidates[cell]!) <= size)
    const open = empty.filter((cell) => bitCount(candidates[cell]!) >= 2)
    for (const cells of combinations(open, size)) {
      const union = cells.reduce((mask, cell) => mask | candidates[cell]!, 0)
      if (bitCount(union) !== size) continue
      const smaller = combinations(cells, 2).some(
        (pair) => size === 3 && bitCount(candidates[pair[0]!]! | candidates[pair[1]!]!) === 2,
      )
      if (smaller) continue
      const eliminations = unitCells
        .filter((cell) => board[cell] === 0 && !cells.includes(cell))
        .flatMap((cell) => digitsOf(candidates[cell]! & union).map((digit) => ({ cell, digit })))
      collect(found, size === 2 ? 'nakedPair' : 'nakedTriple', unit, cells, digitsOf(union), eliminations)
    }
  }
  return steps(found)
}

/**
 * `size` digits of a unit that fit only `size` cells. A subset that contains a smaller subset is
 * skipped, so each pattern has one name.
 */
export function findHiddenSubsets(candidates: Candidates, board: readonly number[], size: 2 | 3): Step[] {
  const found = new Map<string, Pattern>()
  for (const [unit, unitCells] of UNITS.entries()) {
    const places = new Map<Digit, number[]>()
    for (let digit = 1; digit <= 9; digit++) {
      if (unitCells.some((cell) => board[cell] === digit)) continue
      const cells = unitCells.filter((cell) => candidates[cell]! & bitOf(digit))
      if (cells.length >= 2 && cells.length <= size) places.set(digit as Digit, cells)
    }
    for (const digits of combinations([...places.keys()], size)) {
      const cells = sortedUnique(digits.flatMap((digit) => places.get(digit)!))
      if (cells.length !== size) continue
      const smaller = combinations(digits, 2).some(
        (pair) => size === 3 && new Set(pair.flatMap((digit) => places.get(digit)!)).size === 2,
      )
      if (smaller) continue
      const keep = maskOf(digits)
      const eliminations = cells.flatMap((cell) =>
        digitsOf(candidates[cell]! & ~keep).map((digit) => ({ cell, digit })),
      )
      collect(found, size === 2 ? 'hiddenPair' : 'hiddenTriple', unit, cells, digits, eliminations)
    }
  }
  return steps(found)
}
