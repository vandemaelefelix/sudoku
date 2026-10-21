import { shuffled } from '../random'
import type { Random } from '../game/types'

export type TransformKind = 'relabel' | 'rows-in-band' | 'columns-in-stack' | 'bands' | 'stacks' | 'transpose'

export const TRANSFORM_KINDS: readonly TransformKind[] = [
  'relabel',
  'rows-in-band',
  'columns-in-stack',
  'bands',
  'stacks',
  'transpose',
]

const THREE = [0, 1, 2]

/** `order[i]` is the old line that moves to position i. A band swap moves three lines together. */
function lineOrder(random: Random, within: boolean, groups: boolean): number[] {
  const bands = groups ? shuffled(THREE, random) : THREE
  return bands.flatMap((band) => (within ? shuffled(THREE, random) : THREE).map((offset) => band * 3 + offset))
}

/**
 * A puzzle with the same structure: relabel the digits, swap rows in a band, swap columns in a
 * stack, swap bands, swap stacks or transpose. Each one keeps the number of solutions.
 */
export function transformGrid(grid: readonly number[], kind: TransformKind, random: Random): number[] {
  if (kind === 'relabel') {
    const map = [0, ...shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random)]
    return grid.map((digit) => map[digit]!)
  }
  if (kind === 'transpose') return grid.map((_, cell) => grid[(cell % 9) * 9 + Math.floor(cell / 9)]!)
  const rows =
    kind === 'rows-in-band' || kind === 'bands' ? lineOrder(random, kind === 'rows-in-band', kind === 'bands') : null
  const columns =
    kind === 'columns-in-stack' || kind === 'stacks'
      ? lineOrder(random, kind === 'columns-in-stack', kind === 'stacks')
      : null
  return grid.map((_, cell) => {
    const row = rows ? rows[Math.floor(cell / 9)]! : Math.floor(cell / 9)
    const column = columns ? columns[cell % 9]! : cell % 9
    return grid[row * 9 + column]!
  })
}
