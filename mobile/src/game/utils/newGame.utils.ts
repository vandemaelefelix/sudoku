import { createGame, generate, grade, type Game, type Level, type Random } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/newGame.constants'

export type GeneratedGame = { game: Game; seed: number }

export function newGeneratedGame(level: Level, random: Random): GeneratedGame {
  const seed = Math.floor(random() * SEED_COUNT)
  const { givens, solution } = generate(level, seed)
  return { game: createGame({ givens, solution }), seed }
}

/**
 * The level of a scanned puzzle: the level of its grade, with beyond as expert so that the four levels of the sync contract
 * stay (ADR-011, amendment "a level for scanned puzzles by technique"). The givens must have exactly one solution.
 */
export function scannedLevel(givens: readonly number[]): Level {
  const { level } = grade(givens)
  return level === 'beyond' ? 'expert' : level
}
