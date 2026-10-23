import type { GameStorage } from '@/storage/gameStorage.types'
import {
  GENERATED,
  type StorageOpener,
  WITH_SCANNED,
  clocked,
  finishGame,
  lostGame,
  movedGame,
  newGame,
  testDeps,
  wonGame,
  wonWithHint,
  wonWithMistake,
} from './fixtures.testkit'

export function describeStats(open: StorageOpener): void {
  let storage: GameStorage

  beforeEach(async () => {
    storage = await open(testDeps())
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
        averageMs: 75_000,
        flawlessWins: 1,
        averageMistakes: 1,
        averageHints: 0.25,
      })
    })

    it('has an average time only where it has a best time: both count the same games', async () => {
      await finishGame(storage, 'easy', wonWithHint(30_000))
      await finishGame(storage, 'hard', wonGame(10_000), 'scanned')
      const [easy, hard] = await Promise.all([
        storage.stats.summary('easy', WITH_SCANNED),
        storage.stats.summary('hard', WITH_SCANNED),
      ])
      for (const summary of [easy, hard]) expect(summary).toMatchObject({ bestMs: null, averageMs: null })
    })

    it('gives a win rate of 0 for a level with only lost games', async () => {
      await finishGame(storage, 'hard', lostGame(20_000))
      await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, winRate: 0 })
    })

    it('counts an abandoned game apart from the win rate', async () => {
      await finishGame(storage, 'easy', wonGame(60_000))
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(id, movedGame(), null)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
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
        averageMs: 60_000,
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
}
