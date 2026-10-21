import { generate, grade, LEVELS, type Level } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'
import { newGeneratedGame, scannedLevel } from './start.utils'

it('generates a game at the level, with the seed from the random number', () => {
  const { game, seed } = newGeneratedGame('hard', () => 0.5)
  expect(seed).toBe(500_000)
  expect(grade(game.givens).level).toBe('hard')
  expect(game.givens).toEqual(generate('hard', 500_000).givens)
  expect(game).toMatchObject({ status: 'playing', mistakes: 0, playedMs: 0 })
})

it('keeps the seed below SEED_COUNT for a random number just below 1', () => {
  expect(newGeneratedGame('easy', () => 0.9999999999).seed).toBe(SEED_COUNT - 1)
})

const parse = (puzzle: string) => [...puzzle].map(Number)

describe('scannedLevel', () => {
  // The puzzles come from the pinned set of the grade tests in @sudoku/core.
  it.each<[string, Level, string]>([
    ['easy', 'easy', '645700800000580400080946705754030029120407080000000074492008000308624050010079000'],
    ['medium', 'medium', '804060700306900408279005600042690000000100000030000901607500030000012000020000000'],
    ['hard', 'hard', '680000000004000070009000015090326000010070068002004700940600103000000904800209600'],
    ['expert', 'expert', '008090100000008327200030000000010006019065008000000970806021090002083000900070002'],
    [
      'one that the solver cannot finish',
      'expert',
      '005068000086002305000001078000000002030080560600030000001003409208010000390850000',
    ],
  ])('gives %s the level %s', (_name, level, puzzle) => {
    expect(scannedLevel(parse(puzzle))).toBe(level)
  })

  it('still has a puzzle that the solver cannot finish in the set above', () => {
    expect(
      grade(parse('005068000086002305000001078000000002030080560600030000001003409208010000390850000')).level,
    ).toBe('beyond')
  })

  it('gives a generated puzzle its own level', () => {
    for (const level of LEVELS) expect(scannedLevel(generate(level, 7).givens)).toBe(level)
  })
})
