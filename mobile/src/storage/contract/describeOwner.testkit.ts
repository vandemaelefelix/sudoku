import type { GameStorage } from '@/storage/gameStorage.types'
import {
  ALICE,
  BOB,
  type StorageOpener,
  clocked,
  finishGame,
  lostGame,
  movedGame,
  newGame,
  testDeps,
  wonGame,
} from './fixtures.testkit'

export function describeOwner(open: StorageOpener): void {
  describe('owner', () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    it('writes the owner of the finish to the history entry', async () => {
      const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id, result: 'won' }])
      await expect(storage.history.list(null)).resolves.toEqual([])
      await expect(storage.history.list(BOB)).resolves.toEqual([])
    })

    it('writes the owner at the finish, not the owner at the start', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(id, lostGame(20_000), ALICE)
      await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id, result: 'lost' }])
      await expect(storage.history.list(null)).resolves.toEqual([])
    })

    it('gives an abandoned game the owner of the start that replaces it', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(first.id, movedGame(), null)
      await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: ALICE })
      await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: first.id, result: 'abandoned' }])
      await expect(storage.history.list(null)).resolves.toEqual([])
    })

    it('gives the best times of one owner', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      await finishGame(storage, 'easy', wonGame(30_000), 'generated', null)
      await finishGame(storage, 'hard', wonGame(90_000), 'generated', BOB)
      await expect(storage.history.bestTimes(ALICE)).resolves.toEqual({ easy: 60_000 })
      await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 30_000 })
      await expect(storage.history.bestTimes(BOB)).resolves.toEqual({ hard: 90_000 })
    })

    it('clears only the entries of one owner', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      const unowned = await finishGame(storage, 'easy', wonGame(30_000), 'generated', null)
      await storage.history.clear(ALICE)
      await expect(storage.history.list(ALICE)).resolves.toEqual([])
      await expect(storage.history.list(null)).resolves.toMatchObject([{ id: unowned }])
      await storage.history.clear(null)
      await expect(storage.history.list(null)).resolves.toEqual([])
    })

    it('counts every stat only for the owner of the filter', async () => {
      const { storage: clockedStorage, setNow } = await clocked(open)
      storage = clockedStorage
      setNow('2026-10-10T09:00:00.000Z')
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      setNow('2026-10-12T09:00:00.000Z')
      await finishGame(storage, 'easy', lostGame(20_000), 'generated', ALICE)
      await finishGame(storage, 'easy', wonGame(30_000), 'generated', null)
      await finishGame(storage, 'hard', wonGame(90_000), 'generated', BOB)
      const alice = { includeScanned: true, owner: ALICE }
      const signedOut = { includeScanned: true, owner: null }

      await expect(storage.stats.summary(null, alice)).resolves.toMatchObject({ played: 2, won: 1, bestMs: 60_000 })
      await expect(storage.stats.summary(null, signedOut)).resolves.toMatchObject({ played: 1, bestMs: 30_000 })
      const byLevel = await storage.stats.byLevel(alice)
      expect(byLevel.easy).toMatchObject({ played: 2 })
      expect(byLevel.hard).toMatchObject({ played: 0 })
      await expect(storage.stats.recentTimes('easy', 5, alice)).resolves.toEqual([60_000])
      await expect(storage.stats.recentTimes('easy', 5, signedOut)).resolves.toEqual([30_000])
      await expect(storage.stats.streak('UTC', alice)).resolves.toMatchObject({ current: 0, longest: 1 })
      await expect(storage.stats.streak('UTC', signedOut)).resolves.toMatchObject({ current: 1 })
    })
  })
}
