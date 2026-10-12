import { createGame, hint, place, select, tick, type Game } from '@sudoku/core'
import type { GameStorage } from './gameStorage.types'
import type { StorageDeps } from './storage.types'

// The puzzle of the design canvas. Cell 2 is empty and needs a 4.
const GIVENS = digits('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
const SOLUTION = digits('534678912672195348198342567859761423426853791713924856961537284287419635345286179')

function digits(text: string): number[] {
  return [...text].map(Number)
}

export function newGame(): Game {
  return createGame({ givens: GIVENS, solution: SOLUTION })
}

/** Every open cell is filled except cell 2. */
function nearlyWon(): Game {
  const entries = SOLUTION.map((digit, cell) => (GIVENS[cell] === 0 && cell !== 2 ? digit : 0))
  return select(createGame({ givens: GIVENS, solution: SOLUTION, entries }), 2)
}

export function wonGame(playedMs: number): Game {
  return place(tick(nearlyWon(), playedMs), 4).game
}

/** The last cell filled by a hint. */
function wonWithHint(playedMs: number): Game {
  return hint(tick(nearlyWon(), playedMs), () => 0).game
}

/** Three wrong numbers in cell 2. */
export function lostGame(playedMs: number): Game {
  let game = select(tick(newGame(), playedMs), 2)
  for (const digit of [1, 2, 3] as const) game = place(game, digit).game
  return game
}

export function testDeps(): StorageDeps {
  let ids = 0
  let seconds = 0
  return {
    newId: () => `game-${++ids}`,
    now: () => new Date(Date.UTC(2026, 9, 12, 9, 0, seconds++)).toISOString(),
  }
}

/** The rules every GameStorage keeps: the SQLite one and the in-memory fake. */
export function describeGameStorage(name: string, open: (deps: StorageDeps) => Promise<GameStorage>): void {
  describe(name, () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    it('has no game in progress at first', async () => {
      await expect(storage.puzzles.current()).resolves.toBeNull()
    })

    it('returns the game it started', async () => {
      const game = newGame()
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game })
      expect(started).toEqual({ id: 'game-1', level: 'easy', source: 'generated', game })
      await expect(storage.puzzles.current()).resolves.toEqual(started)
    })

    it('discards the game in progress when a new one starts', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const second = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame() })
      await storage.puzzles.save(first.id, tick(newGame(), 5_000))
      await expect(storage.puzzles.current()).resolves.toEqual(second)
    })

    it('refuses to start a won or a lost game', async () => {
      await expect(storage.puzzles.start({ level: 'easy', source: 'generated', game: wonGame(1_000) })).rejects.toThrow(
        RangeError,
      )
      await expect(
        storage.puzzles.start({ level: 'easy', source: 'generated', game: lostGame(1_000) }),
      ).rejects.toThrow(RangeError)
    })

    it('keeps the last move and the time played', async () => {
      const { id } = await storage.puzzles.start({ level: 'medium', source: 'generated', game: newGame() })
      const moved = place(select(tick(newGame(), 61_000), 2), 4).game
      await storage.puzzles.save(id, moved)
      const current = await storage.puzzles.current()
      expect(current?.game).toEqual(moved)
      expect(current?.game.playedMs).toBe(61_000)
    })

    it('moves a won game to the history', async () => {
      const { id } = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: nearlyWon() })
      await storage.puzzles.save(id, wonGame(90_000))
      await expect(storage.puzzles.current()).resolves.toBeNull()
      await expect(storage.history.list()).resolves.toEqual([
        {
          id,
          level: 'hard',
          source: 'scanned',
          result: 'won',
          playedMs: 90_000,
          mistakes: 0,
          hintsUsed: 0,
          finishedAt: expect.any(String),
        },
      ])
    })

    it('moves a lost game to the history', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(id, lostGame(30_000))
      const [entry] = await storage.history.list()
      expect(entry).toMatchObject({ id, result: 'lost', mistakes: 3, playedMs: 30_000 })
    })

    it('saving a finished game twice adds one history entry', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon() })
      await storage.puzzles.save(id, wonGame(40_000))
      await storage.puzzles.save(id, wonGame(40_000))
      await expect(storage.history.list()).resolves.toHaveLength(1)
    })

    it('discards a game without a history entry', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.discard(id)
      await expect(storage.puzzles.current()).resolves.toBeNull()
      await expect(storage.history.list()).resolves.toEqual([])
    })

    it('lists the history newest first', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon() })
      await storage.puzzles.save(first.id, wonGame(10_000))
      const second = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(second.id, lostGame(20_000))
      const ids = (await storage.history.list()).map((entry) => entry.id)
      expect(ids).toEqual([second.id, first.id])
    })

    it('gives the best time per level from won games without hints', async () => {
      await expect(storage.history.bestTimes()).resolves.toEqual({})
      const finish = async (level: 'easy' | 'hard', game: Game) => {
        const { id } = await storage.puzzles.start({ level, source: 'generated', game: newGame() })
        await storage.puzzles.save(id, game)
      }
      await finish('easy', wonGame(90_000))
      await finish('easy', wonGame(60_000))
      await finish('easy', lostGame(30_000))
      await finish('hard', wonGame(200_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({ easy: 60_000, hard: 200_000 })
    })

    it('leaves a won game with a hint out of the best time', async () => {
      const finish = async (game: Game) => {
        const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
        await storage.puzzles.save(id, game)
      }
      await finish(wonWithHint(10_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({})
      await finish(wonGame(60_000))
      await finish(wonWithHint(20_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({ easy: 60_000 })
      await expect(storage.history.list()).resolves.toHaveLength(3)
    })

    it('saves that run together land in their order', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await Promise.all([1_000, 2_000, 3_000].map((ms) => storage.puzzles.save(id, tick(newGame(), ms))))
      expect((await storage.puzzles.current())?.game.playedMs).toBe(3_000)
    })
  })
}
