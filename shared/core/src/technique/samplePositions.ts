import { generate, LEVELS } from '../generator'
import { TIER_1_ORDER } from './order'
import { playThrough, type Position } from './playThrough'

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/**
 * The positions of the bench set: for 10 puzzles of each level, the start, the middle and the last
 * position of a solve with all techniques, the position where a tier 1 solve gets stuck and the final
 * position of the full solve. The solves run with `unique: true`, as the hint does. A position
 * without a step is the slowest kind: the solver tries every technique.
 */
export function benchPositions(): Position[] {
  return LEVELS.flatMap((level) =>
    SEEDS.flatMap((seed) => {
      const { givens } = generate(level, seed)
      const { positions, final } = playThrough(givens, undefined, { unique: true })
      const stuck = playThrough(givens, TIER_1_ORDER).final
      return [positions[0], positions[Math.floor(positions.length / 2)], positions.at(-1), stuck, final].filter(
        (position): position is Position => position !== undefined,
      )
    }),
  )
}
