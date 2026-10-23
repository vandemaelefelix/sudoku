import type { GameStorage } from '@/storage/gameStorage.types'
import { countsForBestTime, place, select, tick, type Game } from '@sudoku/core'
import {
  ALICE,
  type StorageOpener,
  WITH_SCANNED,
  finishGame,
  lostGame,
  movedGame,
  nearlyWon,
  newGame,
  testDeps,
  uuid,
  wonGame,
  wonWithHint,
  wonWithMistake,
} from './fixtures.testkit'

export function describePuzzles(open: StorageOpener): void {
  let storage: GameStorage

  beforeEach(async () => {
    storage = await open(testDeps())
  })

  it('has no game in progress at first', async () => {
    await expect(storage.puzzles.current()).resolves.toBeNull()
  })

  it('returns the game it started', async () => {
    const game = newGame()
    const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game, owner: null })
    expect(started).toEqual({ id: uuid(1), level: 'easy', source: 'generated', seed: null, game })
    await expect(storage.puzzles.current()).resolves.toEqual(started)
  })

  it('peeks the game it started, saved or read, without a read', async () => {
    const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    expect(storage.puzzles.peek()).toEqual(started)
    const moved = place(select(newGame(), 2), 4).game
    const saving = storage.puzzles.save(started.id, moved, null)
    expect(storage.puzzles.peek()?.game).toEqual(moved)
    await saving
    await expect(storage.puzzles.current()).resolves.toEqual(storage.puzzles.peek())
  })

  it('peeks a started game before its write ends', async () => {
    const starting = storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame(), owner: null })
    const peeked = storage.puzzles.peek()
    await expect(starting).resolves.toEqual(peeked)
  })

  it('peeks no game after a discard and after a finished game', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.discard(first.id)
    expect(storage.puzzles.peek()).toBeNull()
    const second = await storage.puzzles.start({ level: 'hard', source: 'generated', game: nearlyWon(), owner: null })
    await storage.puzzles.save(second.id, wonGame(1_000), null)
    expect(storage.puzzles.peek()).toBeNull()
  })

  it('keeps a save in peek when a read from before the save resolves after it', async () => {
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    const reading = storage.puzzles.current()
    const moved = place(select(newGame(), 2), 4).game
    await Promise.all([reading, storage.puzzles.save(id, moved, null)])
    expect(storage.puzzles.peek()?.game).toEqual(moved)
  })

  it('discards the game in progress when a new one starts', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    const second = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame(), owner: null })
    await storage.puzzles.save(first.id, tick(newGame(), 5_000), null)
    await expect(storage.puzzles.current()).resolves.toEqual(second)
  })

  it('records a game as abandoned when a new game replaces it after a move', async () => {
    const first = await storage.puzzles.start({
      level: 'easy',
      source: 'generated',
      seed: 77,
      game: newGame(),
      owner: null,
    })
    await storage.puzzles.save(first.id, movedGame(61_000), null)
    await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })
    await expect(storage.history.list(null)).resolves.toEqual([
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
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    const wrong = place(select(newGame(), 2), 1).game
    await storage.puzzles.save(first.id, wrong, null)
    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    const [entry] = await storage.history.list(null)
    expect(entry).toMatchObject({ id: first.id, result: 'abandoned', mistakes: 1 })
  })

  it('records no entry for a game without a move', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(first.id, select(newGame(), 2), null)
    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await expect(storage.history.list(null)).resolves.toEqual([])
  })

  it('records no abandoned entry when a new game follows a finished game', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon(), owner: null })
    await storage.puzzles.save(first.id, wonGame(40_000), null)
    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    const results = (await storage.history.list(null)).map((entry) => entry.result)
    expect(results).toEqual(['won'])
  })

  it('records no entry for a game that a discard removed', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(first.id, movedGame(), null)
    await storage.puzzles.discard(first.id)
    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await expect(storage.history.list(null)).resolves.toEqual([])
  })

  it('leaves an abandoned game out of the best time', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(first.id, movedGame(5_000), null)
    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await expect(storage.history.bestTimes(null)).resolves.toEqual({})
  })

  it('refuses to start a won or a lost game', async () => {
    await expect(
      storage.puzzles.start({ level: 'easy', source: 'generated', game: wonGame(1_000), owner: null }),
    ).rejects.toThrow(RangeError)
    await expect(
      storage.puzzles.start({ level: 'easy', source: 'generated', game: lostGame(1_000), owner: null }),
    ).rejects.toThrow(RangeError)
  })

  it('keeps the last move and the time played', async () => {
    const { id } = await storage.puzzles.start({ level: 'medium', source: 'generated', game: newGame(), owner: null })
    const moved = place(select(tick(newGame(), 61_000), 2), 4).game
    await storage.puzzles.save(id, moved, null)
    const current = await storage.puzzles.current()
    expect(current?.game).toEqual(moved)
    expect(current?.game.playedMs).toBe(61_000)
  })

  it('moves a won game to the history', async () => {
    const { id } = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: nearlyWon(), owner: null })
    await storage.puzzles.save(id, wonGame(90_000), null)
    await expect(storage.puzzles.current()).resolves.toBeNull()
    await expect(storage.history.list(null)).resolves.toEqual([
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
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(id, lostGame(30_000), null)
    const [entry] = await storage.history.list(null)
    expect(entry).toMatchObject({ id, result: 'lost', mistakes: 3, playedMs: 30_000 })
  })

  it('saving a finished game twice adds one history entry', async () => {
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon(), owner: null })
    await storage.puzzles.save(id, wonGame(40_000), null)
    await storage.puzzles.save(id, wonGame(40_000), null)
    await expect(storage.history.list(null)).resolves.toHaveLength(1)
  })

  it('discards a game without a history entry', async () => {
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.discard(id)
    await expect(storage.puzzles.current()).resolves.toBeNull()
    await expect(storage.history.list(null)).resolves.toEqual([])
  })

  it('lists the history newest first', async () => {
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon(), owner: null })
    await storage.puzzles.save(first.id, wonGame(10_000), null)
    const second = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(second.id, lostGame(20_000), null)
    const ids = (await storage.history.list(null)).map((entry) => entry.id)
    expect(ids).toEqual([second.id, first.id])
  })

  it('gives the best time per level from won games without hints', async () => {
    await expect(storage.history.bestTimes(null)).resolves.toEqual({})
    const finish = async (level: 'easy' | 'hard', game: Game) => {
      const { id } = await storage.puzzles.start({ level, source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(id, game, null)
    }
    await finish('easy', wonGame(90_000))
    await finish('easy', wonGame(60_000))
    await finish('easy', lostGame(30_000))
    await finish('hard', wonGame(200_000))
    await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 60_000, hard: 200_000 })
  })

  it('leaves a won game with a hint out of the best time', async () => {
    const finish = async (game: Game) => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(id, game, null)
    }
    await finish(wonWithHint(10_000))
    await expect(storage.history.bestTimes(null)).resolves.toEqual({})
    await finish(wonGame(60_000))
    await finish(wonWithHint(20_000))
    await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 60_000 })
    await expect(storage.history.list(null)).resolves.toHaveLength(3)
  })

  it('keeps the seed of a generated game in progress and in the history', async () => {
    const started = await storage.puzzles.start({
      level: 'easy',
      source: 'generated',
      seed: 412_077,
      game: nearlyWon(),
      owner: null,
    })
    expect(started.seed).toBe(412_077)
    await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: 412_077 })
    await storage.puzzles.save(started.id, wonGame(40_000), null)
    await expect(storage.history.list(null)).resolves.toMatchObject([{ id: started.id, seed: 412_077 }])
  })

  it('gives a game without a seed the seed null', async () => {
    const started = await storage.puzzles.start({ level: 'easy', source: 'scanned', game: newGame(), owner: null })
    expect(started.seed).toBeNull()
    await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: null })
  })

  it('leaves a scanned game out of the best time', async () => {
    const finish = async (source: 'generated' | 'scanned', game: Game) => {
      const { id } = await storage.puzzles.start({ level: 'easy', source, game: newGame(), owner: null })
      await storage.puzzles.save(id, game, null)
    }
    await finish('scanned', wonGame(10_000))
    await expect(storage.history.bestTimes(null)).resolves.toEqual({})
    await finish('generated', wonGame(60_000))
    await finish('scanned', wonGame(20_000))
    await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 60_000 })
  })

  it('counts the best and the average time by countsForBestTime', async () => {
    await finishGame(storage, 'easy', wonGame(90_000))
    await finishGame(storage, 'easy', wonGame(60_000))
    await finishGame(storage, 'easy', wonWithHint(10_000))
    await finishGame(storage, 'easy', wonWithMistake(70_000))
    await finishGame(storage, 'easy', wonGame(20_000), 'scanned')
    await finishGame(storage, 'easy', lostGame(5_000))
    await finishGame(storage, 'hard', wonWithHint(30_000))
    await finishGame(storage, 'hard', wonGame(200_000))
    await finishGame(storage, 'easy', wonGame(1_000), 'generated', ALICE)
    const { id } = await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(id, movedGame(1_000), null)
    await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })

    const entries = await storage.history.list(null)
    const best = await storage.history.bestTimes(null)
    const levels = ['easy', 'medium', 'hard'] as const
    const summaries = await Promise.all(levels.map((level) => storage.stats.summary(level, WITH_SCANNED)))
    for (const [index, level] of levels.entries()) {
      const times = entries
        .filter((entry) => entry.level === level && countsForBestTime(entry))
        .map((entry) => entry.playedMs)
      const summary = summaries[index]
      expect(best[level] ?? null).toBe(times.length === 0 ? null : Math.min(...times))
      expect(summary?.bestMs).toBe(best[level] ?? null)
      expect(summary?.averageMs).toBe(
        times.length === 0 ? null : times.reduce((sum, time) => sum + time, 0) / times.length,
      )
    }
    expect(best).toEqual({ easy: 60_000, hard: 200_000 })
  })

  it('runs the next task after a task that failed', async () => {
    await expect(
      storage.puzzles.start({ level: 'easy', source: 'generated', game: wonGame(1_000), owner: null }),
    ).rejects.toThrow(RangeError)
    const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await expect(storage.puzzles.current()).resolves.toEqual(started)
  })

  it('ignores a save or a discard of a game that is not in progress', async () => {
    const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save('unknown', tick(newGame(), 9_000), null)
    await storage.puzzles.discard('unknown')
    await expect(storage.puzzles.current()).resolves.toEqual(started)
    await storage.puzzles.save(started.id, wonGame(9_000), null)
    await storage.puzzles.discard(started.id)
    await expect(storage.history.list(null)).resolves.toHaveLength(1)
  })

  it('saves that run together land in their order', async () => {
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await Promise.all([1_000, 2_000, 3_000].map((ms) => storage.puzzles.save(id, tick(newGame(), ms), null)))
    expect((await storage.puzzles.current())?.game.playedMs).toBe(3_000)
  })
}
