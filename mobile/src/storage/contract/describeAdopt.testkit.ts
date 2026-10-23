import type { GameStorage } from '@/storage/gameStorage.types'
import { ALICE, BOB, type StorageOpener, batchIds, finishGame, lostGame, testDeps, wonGame } from './fixtures.testkit'

export function describeAdopt(open: StorageOpener): void {
  describe('adopt', () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    it('counts the live entries without an owner', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await finishGame(storage, 'hard', lostGame(20_000), 'generated', null)
      await finishGame(storage, 'easy', wonGame(50_000), 'generated', ALICE)
      await expect(storage.history.adoptable(ALICE)).resolves.toBe(2)
    })

    it('does not count a cleared entry and does not change anything', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await storage.history.clear(null)
      await expect(storage.history.adoptable(ALICE)).resolves.toBe(0)
      await expect(storage.history.adoptable(ALICE)).resolves.toBe(0)
    })

    it('gives the entries without an owner to the owner on yes, and puts them on the waiting list', async () => {
      const first = await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      const second = await finishGame(storage, 'hard', lostGame(20_000), 'generated', null)
      await expect(storage.history.answerAdopt(ALICE, true)).resolves.toBe(2)
      await expect(storage.history.list(null)).resolves.toEqual([])
      const ids = (await storage.history.list(ALICE)).map((entry) => entry.id)
      expect(ids).toEqual([second, first])
      expect(await batchIds(storage, ALICE)).toEqual([first, second])
    })

    it('leaves the entries without an owner on no', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await expect(storage.history.answerAdopt(ALICE, false)).resolves.toBe(0)
      await expect(storage.history.list(null)).resolves.toHaveLength(1)
      await expect(storage.history.list(ALICE)).resolves.toEqual([])
    })

    it('leaves a cleared entry without an owner', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await storage.history.clear(null)
      const live = await finishGame(storage, 'easy', wonGame(50_000), 'generated', null)
      await expect(storage.history.answerAdopt(ALICE, true)).resolves.toBe(1)
      expect(await batchIds(storage, ALICE)).toEqual([live])
    })

    it('leaves the entries of another owner', async () => {
      const bob = await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
      await expect(storage.history.answerAdopt(ALICE, true)).resolves.toBe(0)
      await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id: bob }])
      await expect(storage.history.list(ALICE)).resolves.toEqual([])
    })

    it('offers nothing again to an owner who answered, yes or no, and still offers to another owner', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await storage.history.answerAdopt(ALICE, false)
      await expect(storage.history.adoptable(ALICE)).resolves.toBe(0)
      await expect(storage.history.adoptable(BOB)).resolves.toBe(1)
      await storage.history.answerAdopt(BOB, true)
      await expect(storage.history.adoptable(BOB)).resolves.toBe(0)
    })
  })
}
