import type { GameStorage } from '@/storage/gameStorage.types'
import { ALICE, BOB, type StorageOpener, accepting, finishGame, lostGame, testDeps, wonGame } from './fixtures.testkit'

export function describeDeleteOwner(open: StorageOpener): void {
  describe('deleteOwner', () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    it('removes every entry of the owner, live and deleted, for good', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      await storage.history.clear(ALICE)
      await finishGame(storage, 'hard', lostGame(20_000), 'generated', ALICE)
      await storage.history.deleteOwner(ALICE)
      await expect(storage.history.list(ALICE)).resolves.toEqual([])
      await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
    })

    it('leaves the entries of another owner and of no owner', async () => {
      const bob = await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
      const nobody = await finishGame(storage, 'easy', wonGame(61_000), 'generated', null)
      await finishGame(storage, 'easy', wonGame(62_000), 'generated', ALICE)
      await storage.history.deleteOwner(ALICE)
      await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id: bob }])
      await expect(storage.history.list(null)).resolves.toMatchObject([{ id: nobody }])
    })

    it('clears the sync state of the owner and nothing of another owner', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await storage.history.applySyncPage({ ...accepting(ALICE, []), cursor: 'cursor-1' })
      await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
      await storage.sync.saveSyncedAt(BOB, '2026-10-15T11:00:00.000Z')
      await storage.history.answerAdopt(ALICE, false)
      await storage.history.answerAdopt(BOB, false)
      await storage.history.deleteOwner(ALICE)
      await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
      await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
      await expect(storage.history.adoptable(ALICE)).resolves.toBe(1)
      await expect(storage.sync.syncedAt(BOB)).resolves.toBe('2026-10-15T11:00:00.000Z')
      await expect(storage.history.adoptable(BOB)).resolves.toBe(0)
    })

    it('keeps the cursor of another owner', async () => {
      await storage.history.applySyncPage({ ...accepting(BOB, []), cursor: 'cursor-bob' })
      await storage.history.deleteOwner(ALICE)
      await expect(storage.sync.cursor(BOB)).resolves.toBe('cursor-bob')
    })
  })
}
