import type { GameStorage } from '@/storage/gameStorage.types'
import { ALICE, type StorageOpener, lostGame, movedGame, newGame, testDeps, wonGame } from './fixtures.testkit'

export function describeSubscribe(open: StorageOpener): void {
  let storage: GameStorage

  beforeEach(async () => {
    storage = await open(testDeps())
  })

  describe('subscribe', () => {
    it('fires after a won game and after a lost game', async () => {
      const listener = jest.fn()
      storage.subscribe(listener)
      const won = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: ALICE })
      listener.mockClear()
      await storage.puzzles.save(won.id, wonGame(60_000), ALICE)
      expect(listener).toHaveBeenCalledTimes(1)
      const lost = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: ALICE })
      listener.mockClear()
      await storage.puzzles.save(lost.id, lostGame(20_000), ALICE)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('fires after a start that can abandon a game, and after a clear', async () => {
      const listener = jest.fn()
      storage.subscribe(listener)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: movedGame(), owner: ALICE })
      expect(listener).toHaveBeenCalledTimes(1)
      await storage.history.clear(ALICE)
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('does not fire for a move', async () => {
      const { id } = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        game: newGame(),
        owner: ALICE,
      })
      const listener = jest.fn()
      storage.subscribe(listener)
      await storage.puzzles.save(id, movedGame(), ALICE)
      expect(listener).not.toHaveBeenCalled()
    })

    it('fires only after the write resolved, so the waiting list has the entry', async () => {
      const { id } = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        game: newGame(),
        owner: ALICE,
      })
      let seen = -1
      storage.subscribe(() => {
        void storage.history.nextBatch(ALICE).then((batch) => {
          seen = batch.length
        })
      })
      await storage.puzzles.save(id, wonGame(60_000), ALICE)
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(seen).toBe(1)
    })

    it('stops after the unsubscribe and survives a throwing listener', async () => {
      const listener = jest.fn()
      const off = storage.subscribe(listener)
      storage.subscribe(() => {
        throw new Error('listener bug')
      })
      off()
      const { id } = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        game: newGame(),
        owner: ALICE,
      })
      await expect(storage.puzzles.save(id, wonGame(60_000), ALICE)).resolves.toBeUndefined()
      expect(listener).not.toHaveBeenCalled()
    })
  })
}
