import { createGame, generate, GIVENS_TARGET, LEVELS, type Game, type Level, type Random } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'

export type GeneratedGame = { game: Game; seed: number }

export function newGeneratedGame(level: Level, random: Random): GeneratedGame {
  const seed = Math.floor(random() * SEED_COUNT)
  const { givens, solution } = generate(level, seed)
  return { game: createGame({ givens, solution }), seed }
}

/** The level whose givens target is nearest (ADR-011, amendment "a level for scanned puzzles"). A tie goes to the easier level. */
export function levelOf(givens: readonly number[]): Level {
  const count = givens.filter((digit) => digit !== 0).length
  const distance = (level: Level) => Math.abs(GIVENS_TARGET[level] - count)
  // LEVELS runs from easy to expert, and only a nearer level replaces the best one.
  return LEVELS.reduce((best, level) => (distance(level) < distance(best) ? level : best))
}
