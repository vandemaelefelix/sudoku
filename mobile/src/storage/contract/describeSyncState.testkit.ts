import type { GameStorage } from '@/storage/gameStorage.types'
import { ALICE, BOB, type StorageOpener, seedCursor, testDeps } from './fixtures.testkit'

export function describeSyncState(open: StorageOpener): void {
  describe('sync state', () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    it('has no cursor or time at first', async () => {
      await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
      await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
    })

    it('keeps the cursor of its owner', async () => {
      await seedCursor(storage, ALICE, 'cursor-1')
      await expect(storage.sync.cursor(ALICE)).resolves.toBe('cursor-1')
      await seedCursor(storage, ALICE, 'cursor-2')
      await expect(storage.sync.cursor(ALICE)).resolves.toBe('cursor-2')
    })

    it('gives no cursor to another owner and forgets the old one', async () => {
      await seedCursor(storage, ALICE, 'cursor-1')
      await expect(storage.sync.cursor(BOB)).resolves.toBeNull()
      await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
    })

    it('clears the cursor alone', async () => {
      await seedCursor(storage, ALICE, 'cursor-1')
      await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
      await storage.sync.clearCursor()
      await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
      await expect(storage.sync.syncedAt(ALICE)).resolves.toBe('2026-10-15T10:00:00.000Z')
    })

    it('keeps the time of the last sync per owner', async () => {
      await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
      await expect(storage.sync.syncedAt(ALICE)).resolves.toBe('2026-10-15T10:00:00.000Z')
      await expect(storage.sync.syncedAt(BOB)).resolves.toBeNull()
    })
  })
}
