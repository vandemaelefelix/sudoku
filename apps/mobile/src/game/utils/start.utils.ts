import { createGame, generate, type Game, type Level, type Random } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'

export function newGeneratedGame(level: Level, random: Random): Game {
  const { givens, solution } = generate(level, Math.floor(random() * SEED_COUNT))
  return createGame({ givens, solution })
}
