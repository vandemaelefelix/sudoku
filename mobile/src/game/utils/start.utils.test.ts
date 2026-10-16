import { GIVENS_TARGET, generate } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'
import { newGeneratedGame } from './start.utils'

it('generates a game at the level, with the seed from the random number', () => {
  const { game, seed } = newGeneratedGame('hard', () => 0.5)
  expect(seed).toBe(500_000)
  expect(game.givens.filter((digit) => digit !== 0)).toHaveLength(GIVENS_TARGET.hard)
  expect(game.givens).toEqual(generate('hard', 500_000).givens)
  expect(game).toMatchObject({ status: 'playing', mistakes: 0, playedMs: 0 })
})

it('keeps the seed below SEED_COUNT for a random number just below 1', () => {
  expect(newGeneratedGame('easy', () => 0.9999999999).seed).toBe(SEED_COUNT - 1)
})
