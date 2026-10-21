import { generate, LEVELS } from '../generator'
import { playThrough, type Position } from './playThrough'

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/**
 * The positions of the bench set: for 10 puzzles of each level, the start, the middle and the last
 * position of a tier 1 solve. The start has the most empty cells, so it is the slowest kind.
 */
export function benchPositions(): Position[] {
  return LEVELS.flatMap((level) =>
    SEEDS.flatMap((seed) => {
      const { positions } = playThrough(generate(level, seed).givens)
      return [positions[0], positions[Math.floor(positions.length / 2)], positions.at(-1)].filter(
        (position): position is Position => position !== undefined,
      )
    }),
  )
}
