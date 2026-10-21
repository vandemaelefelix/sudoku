import { GIVENS_TARGET, LEVELS, generate, type Level } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'
import { levelOf, newGeneratedGame } from './start.utils'

const withGivens = (count: number) => Array.from({ length: 81 }, (_, cell) => (cell < count ? 1 : 0))

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

describe('levelOf', () => {
  it.each<[number, Level]>([
    [81, 'easy'],
    [40, 'easy'],
    [37, 'easy'],
    [36, 'medium'],
    [34, 'medium'],
    [32, 'medium'],
    [31, 'hard'],
    [29, 'hard'],
    [27, 'hard'],
    [26, 'expert'],
    [25, 'expert'],
    [17, 'expert'],
    [0, 'expert'],
  ])('gives %i givens the level %s', (count, level) => {
    expect(levelOf(withGivens(count))).toBe(level)
  })

  it('gives each generated puzzle its own level back', () => {
    for (const level of LEVELS) {
      const { givens } = generate(level, 3)
      expect(givens.filter((digit) => digit !== 0)).toHaveLength(GIVENS_TARGET[level])
      expect(levelOf(givens)).toBe(level)
    }
  })
})
