import type { GameStorage } from '@/storage/gameStorage.types'
import {
  GENERATED,
  type StorageOpener,
  WITH_SCANNED,
  finishGame,
  lostGame,
  movedGame,
  newGame,
  testDeps,
  wonGame,
} from './fixtures.testkit'

export function describeClear(open: StorageOpener): void {
  let storage: GameStorage

  beforeEach(async () => {
    storage = await open(testDeps())
  })

  describe('clear', () => {
    it('removes every history entry from the list, the best times and the stats', async () => {
      await finishGame(storage, 'easy', wonGame(60_000))
      await finishGame(storage, 'hard', lostGame(20_000))
      await storage.history.clear(null)
      await expect(storage.history.list(null)).resolves.toEqual([])
      await expect(storage.history.bestTimes(null)).resolves.toEqual({})
      await expect(storage.stats.summary(null, WITH_SCANNED)).resolves.toMatchObject({ played: 0, abandoned: 0 })
      await expect(storage.stats.streak('UTC', WITH_SCANNED)).resolves.toMatchObject({ current: 0, longest: 0 })
    })

    it('keeps the game in progress', async () => {
      const started = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        game: newGame(),
        owner: null,
      })
      await storage.puzzles.save(started.id, movedGame(), null)
      await storage.history.clear(null)
      await expect(storage.puzzles.current()).resolves.toMatchObject({ id: started.id })
    })

    it('counts the games that finish afterwards', async () => {
      await finishGame(storage, 'easy', wonGame(60_000))
      await storage.history.clear(null)
      await finishGame(storage, 'easy', wonGame(30_000))
      await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({ played: 1, bestMs: 30_000 })
    })
  })
}
