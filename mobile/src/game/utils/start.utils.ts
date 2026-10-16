import { createGame, generate, type Game, type Level, type Random } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'

export type GeneratedGame = { game: Game; seed: number }

export function newGeneratedGame(level: Level, random: Random): GeneratedGame {
  const seed = Math.floor(random() * SEED_COUNT)
  const { givens, solution } = generate(level, seed)
  return { game: createGame({ givens, solution }), seed }
}
