import { createGame, hint, place, select, tick, type Game } from '@sudoku/core'
import type { GameStorage } from './gameStorage.types'
import type { Level, PuzzleSource, StorageDeps } from './storage.types'

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
export function wonWithHint(playedMs: number): Game {
  return hint(tick(nearlyWon(), playedMs), () => 0).game
}

/** One mistake, then the right number in cell 2. The mistake is set directly: place refuses a complete digit, and only 4 is open. */
export function wonWithMistake(playedMs: number): Game {
  return place({ ...tick(nearlyWon(), playedMs), mistakes: 1 }, 4).game
}

/** A game in progress that has one move and no mistake. */
export function movedGame(playedMs = 61_000): Game {
  return place(select(tick(newGame(), playedMs), 2), 4).game
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

const GENERATED = { includeScanned: false }
const WITH_SCANNED = { includeScanned: true }

async function finishGame(storage: GameStorage, level: Level, game: Game, source: PuzzleSource = 'generated') {
  const { id } = await storage.puzzles.start({ level, source, game: newGame() })
  await storage.puzzles.save(id, game)
}

/** Storage whose clock the test sets, so a win lands on a chosen day. */
async function clocked(open: (deps: StorageDeps) => Promise<GameStorage>) {
  let nowIso = '2026-10-10T09:00:00.000Z'
  let ids = 0
  const clockedStorage = await open({ newId: () => `clocked-${++ids}`, now: () => nowIso })
  return {
    storage: clockedStorage,
    setNow: (iso: string) => {
      nowIso = iso
    },
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
      expect(started).toEqual({ id: 'game-1', level: 'easy', source: 'generated', seed: null, game })
      await expect(storage.puzzles.current()).resolves.toEqual(started)
    })

    it('peeks the game it started, saved or read, without a read', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      expect(storage.puzzles.peek()).toEqual(started)
      const moved = place(select(newGame(), 2), 4).game
      const saving = storage.puzzles.save(started.id, moved)
      expect(storage.puzzles.peek()?.game).toEqual(moved)
      await saving
      await expect(storage.puzzles.current()).resolves.toEqual(storage.puzzles.peek())
    })

    it('peeks a started game before its write ends', async () => {
      const starting = storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame() })
      const peeked = storage.puzzles.peek()
      await expect(starting).resolves.toEqual(peeked)
    })

    it('peeks no game after a discard and after a finished game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.discard(first.id)
      expect(storage.puzzles.peek()).toBeNull()
      const second = await storage.puzzles.start({ level: 'hard', source: 'generated', game: nearlyWon() })
      await storage.puzzles.save(second.id, wonGame(1_000))
      expect(storage.puzzles.peek()).toBeNull()
    })

    it('keeps a save in peek when a read from before the save resolves after it', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const reading = storage.puzzles.current()
      const moved = place(select(newGame(), 2), 4).game
      await Promise.all([reading, storage.puzzles.save(id, moved)])
      expect(storage.puzzles.peek()?.game).toEqual(moved)
    })

    it('discards the game in progress when a new one starts', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const second = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame() })
      await storage.puzzles.save(first.id, tick(newGame(), 5_000))
      await expect(storage.puzzles.current()).resolves.toEqual(second)
    })

    it('records a game as abandoned when a new game replaces it after a move', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', seed: 77, game: newGame() })
      await storage.puzzles.save(first.id, movedGame(61_000))
      await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame() })
      await expect(storage.history.list()).resolves.toEqual([
        {
          id: first.id,
          level: 'easy',
          source: 'generated',
          seed: 77,
          result: 'abandoned',
          playedMs: 61_000,
          mistakes: 0,
          hintsUsed: 0,
          finishedAt: expect.any(String),
        },
      ])
    })

    it('keeps the mistakes and the hints of an abandoned game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const wrong = place(select(newGame(), 2), 1).game
      await storage.puzzles.save(first.id, wrong)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const [entry] = await storage.history.list()
      expect(entry).toMatchObject({ id: first.id, result: 'abandoned', mistakes: 1 })
    })

    it('records no entry for a game without a move', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(first.id, select(newGame(), 2))
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.history.list()).resolves.toEqual([])
    })

    it('records no abandoned entry when a new game follows a finished game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon() })
      await storage.puzzles.save(first.id, wonGame(40_000))
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const results = (await storage.history.list()).map((entry) => entry.result)
      expect(results).toEqual(['won'])
    })

    it('records no entry for a game that a discard removed', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(first.id, movedGame())
      await storage.puzzles.discard(first.id)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.history.list()).resolves.toEqual([])
    })

    it('leaves an abandoned game out of the best time', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(first.id, movedGame(5_000))
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.history.bestTimes()).resolves.toEqual({})
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
          seed: null,
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

    it('keeps the seed of a generated game in progress and in the history', async () => {
      const started = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        seed: 412_077,
        game: nearlyWon(),
      })
      expect(started.seed).toBe(412_077)
      await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: 412_077 })
      await storage.puzzles.save(started.id, wonGame(40_000))
      await expect(storage.history.list()).resolves.toMatchObject([{ id: started.id, seed: 412_077 }])
    })

    it('gives a game without a seed the seed null', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'scanned', game: newGame() })
      expect(started.seed).toBeNull()
      await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: null })
    })

    it('leaves a scanned game out of the best time', async () => {
      const finish = async (source: 'generated' | 'scanned', game: Game) => {
        const { id } = await storage.puzzles.start({ level: 'easy', source, game: newGame() })
        await storage.puzzles.save(id, game)
      }
      await finish('scanned', wonGame(10_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({})
      await finish('generated', wonGame(60_000))
      await finish('scanned', wonGame(20_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({ easy: 60_000 })
    })

    it('runs the next task after a task that failed', async () => {
      await expect(storage.puzzles.start({ level: 'easy', source: 'generated', game: wonGame(1_000) })).rejects.toThrow(
        RangeError,
      )
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.puzzles.current()).resolves.toEqual(started)
    })

    it('ignores a save or a discard of a game that is not in progress', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save('unknown', tick(newGame(), 9_000))
      await storage.puzzles.discard('unknown')
      await expect(storage.puzzles.current()).resolves.toEqual(started)
      await storage.puzzles.save(started.id, wonGame(9_000))
      await storage.puzzles.discard(started.id)
      await expect(storage.history.list()).resolves.toHaveLength(1)
    })

    it('saves that run together land in their order', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await Promise.all([1_000, 2_000, 3_000].map((ms) => storage.puzzles.save(id, tick(newGame(), ms))))
      expect((await storage.puzzles.current())?.game.playedMs).toBe(3_000)
    })

    describe('stats', () => {
      const NOTHING = {
        played: 0,
        won: 0,
        lost: 0,
        abandoned: 0,
        winRate: null,
        bestMs: null,
        averageMs: null,
        flawlessWins: 0,
        averageMistakes: null,
        averageHints: null,
      }

      it('has no numbers before the first game', async () => {
        await expect(storage.stats.summary(null, GENERATED)).resolves.toEqual(NOTHING)
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toEqual(NOTHING)
      })

      it('counts the games of a level by the rules of ADR-023', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        await finishGame(storage, 'easy', wonWithMistake(90_000))
        await finishGame(storage, 'easy', wonWithHint(30_000))
        await finishGame(storage, 'easy', lostGame(20_000))
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toEqual({
          played: 4,
          won: 3,
          lost: 1,
          abandoned: 0,
          winRate: 0.75,
          bestMs: 60_000,
          averageMs: 60_000,
          flawlessWins: 1,
          averageMistakes: 1,
          averageHints: 0.25,
        })
      })

      it('gives a win rate of 0 for a level with only lost games', async () => {
        await finishGame(storage, 'hard', lostGame(20_000))
        await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, winRate: 0 })
      })

      it('counts an abandoned game apart from the win rate', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
        await storage.puzzles.save(id, movedGame())
        await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({
          played: 1,
          won: 1,
          abandoned: 1,
          winRate: 1,
        })
      })

      it('counts one level or all levels', async () => {
        await finishGame(storage, 'easy', wonGame(10_000))
        await finishGame(storage, 'hard', lostGame(20_000))
        await expect(storage.stats.summary(null, GENERATED)).resolves.toMatchObject({ played: 2, won: 1, lost: 1 })
        await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, won: 0 })
      })

      it('counts a scanned game only when the filter says so, and never for the best time', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        await finishGame(storage, 'easy', wonGame(10_000), 'scanned')
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({
          played: 1,
          averageMs: 60_000,
          bestMs: 60_000,
        })
        await expect(storage.stats.summary('easy', WITH_SCANNED)).resolves.toMatchObject({
          played: 2,
          averageMs: 35_000,
          bestMs: 60_000,
        })
      })

      it('gives the summary of each of the four levels', async () => {
        await finishGame(storage, 'medium', wonGame(10_000))
        const levels = await storage.stats.byLevel(GENERATED)
        expect(Object.keys(levels)).toEqual(['easy', 'medium', 'hard', 'expert'])
        expect(levels.medium).toMatchObject({ played: 1, won: 1 })
        expect(levels.expert).toEqual(NOTHING)
      })

      it('gives the times of the last wins, oldest first', async () => {
        await finishGame(storage, 'easy', wonGame(10_000))
        await finishGame(storage, 'easy', wonGame(20_000))
        await finishGame(storage, 'easy', wonGame(30_000))
        await finishGame(storage, 'easy', lostGame(5_000))
        await expect(storage.stats.recentTimes('easy', 2, GENERATED)).resolves.toEqual([20_000, 30_000])
        await expect(storage.stats.recentTimes('hard', 5, GENERATED)).resolves.toEqual([])
      })

      describe('streak', () => {
        it('counts the days in a row with a win, and lets a day pass', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          for (const day of ['2026-10-10', '2026-10-11', '2026-10-12']) {
            setNow(`${day}T09:00:00.000Z`)
            // oxlint-disable-next-line no-await-in-loop -- each win needs its own clock time, so the games run in order.
            await finishGame(clockedStorage, 'easy', wonGame(60_000))
          }
          setNow('2026-10-12T20:00:00.000Z')
          const streak = await clockedStorage.stats.streak('UTC', GENERATED)
          expect(streak).toMatchObject({ current: 3, longest: 3 })
          expect(streak.recent).toHaveLength(14)
          expect(streak.recent.slice(-3)).toEqual([true, true, true])
          setNow('2026-10-13T08:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 3 })
          setNow('2026-10-14T08:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 0, longest: 3 })
        })

        it('counts the day in the time zone of the player', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          setNow('2026-10-12T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-12T11:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-12T12:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 1 })
          await expect(clockedStorage.stats.streak('Pacific/Kiritimati', GENERATED)).resolves.toMatchObject({
            current: 2,
          })
        })

        it('does not count a lost game or an abandoned game as a win', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          setNow('2026-10-10T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-11T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', lostGame(20_000))
          setNow('2026-10-12T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({
            current: 1,
            longest: 1,
          })
        })

        it('counts a scanned win only when the filter says so', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          setNow('2026-10-12T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000), 'scanned')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 0 })
          await expect(clockedStorage.stats.streak('UTC', WITH_SCANNED)).resolves.toMatchObject({ current: 1 })
        })
      })
    })
  })
}
