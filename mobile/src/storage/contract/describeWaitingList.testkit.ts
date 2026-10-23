import { MAX_ENTRIES_PER_SYNC } from '@sudoku/sync-contract'
import type { GameStorage } from '@/storage/gameStorage.types'
import {
  ALICE,
  BOB,
  type StorageOpener,
  accepting,
  batchIds,
  clocked,
  finishGame,
  lostGame,
  single,
  testDeps,
  uuid,
  wonGame,
} from './fixtures.testkit'

export function describeWaitingList(open: StorageOpener): void {
  let storage: GameStorage

  beforeEach(async () => {
    storage = await open(testDeps())
  })

  describe('waiting list', () => {
    it('holds a finished game of the owner with its timestamps', async () => {
      const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      const entry = single(await storage.history.list(ALICE))
      await expect(storage.history.nextBatch(ALICE)).resolves.toEqual([
        { ...entry, id, createdAt: entry.finishedAt, updatedAt: entry.finishedAt, deletedAt: null },
      ])
      await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(true)
    })

    it('holds only the entries of the owner, oldest change first', async () => {
      const first = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      await finishGame(storage, 'easy', wonGame(50_000), 'generated', null)
      await finishGame(storage, 'easy', wonGame(40_000), 'generated', BOB)
      const second = await finishGame(storage, 'hard', lostGame(20_000), 'generated', ALICE)
      const third = await finishGame(storage, 'hard', wonGame(90_000), 'generated', ALICE)
      expect(await batchIds(storage, ALICE)).toEqual([first, second, third])
    })

    it('never holds a game finished while signed out', async () => {
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
      await expect(storage.history.nextBatch(ALICE)).resolves.toEqual([])
      await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
    })

    it('gives one request of entries, then the rest after the server took them', async () => {
      const ids: string[] = []
      for (let n = 0; n < MAX_ENTRIES_PER_SYNC + 1; n += 1) {
        // oxlint-disable-next-line no-await-in-loop -- the clock and the ids count the calls in order.
        ids.push(await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE))
      }
      const first = await storage.history.nextBatch(ALICE)
      expect(first.map((record) => record.id)).toEqual(ids.slice(0, MAX_ENTRIES_PER_SYNC))
      await storage.history.applySyncPage(accepting(ALICE, first))
      expect(await batchIds(storage, ALICE)).toEqual(ids.slice(MAX_ENTRIES_PER_SYNC))
    })

    it('holds a cleared entry again, as a deleted entry with a newer change', async () => {
      const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      const sent = single(await storage.history.nextBatch(ALICE))
      await storage.history.applySyncPage(accepting(ALICE, [sent]))
      await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      await storage.history.clear(ALICE)
      const deleted = single(await storage.history.nextBatch(ALICE))
      expect(deleted).toMatchObject({ id, deletedAt: expect.any(String) })
      expect(deleted.updatedAt > sent.updatedAt).toBe(true)
    })

    it('holds an entry of a clock ahead until the server takes it', async () => {
      const { storage: clockedStorage, setNow } = await clocked(open)
      storage = clockedStorage
      setNow('2030-01-01T00:00:00.000Z')
      await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
      setNow('2026-10-12T10:00:00.000Z')
      const sent = single(await storage.history.nextBatch(ALICE))
      await storage.history.applySyncPage(accepting(ALICE, [sent]))
      await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
    })

    describe('an entry that breaks the sync contract', () => {
      const BAD = 'not-a-uuid'

      async function openWithIds(bad: number): Promise<GameStorage> {
        let ids = 0
        return open({
          newId: () => (++ids <= bad ? `${BAD}-${ids}` : uuid(ids)),
          now: testDeps().now,
        })
      }

      it('stays on the waiting list and never leaves in a batch', async () => {
        const mixed = await openWithIds(1)
        await finishGame(mixed, 'easy', wonGame(60_000), 'generated', ALICE)
        const good = await finishGame(mixed, 'easy', wonGame(50_000), 'generated', ALICE)
        expect(await batchIds(mixed, ALICE)).toEqual([good])
        await mixed.history.applySyncPage(accepting(ALICE, await mixed.history.nextBatch(ALICE)))
        await expect(mixed.history.nextBatch(ALICE)).resolves.toEqual([])
        await expect(mixed.history.hasWaiting(ALICE)).resolves.toBe(true)
      })

      it('does not block the valid entries behind it', async () => {
        const mixed = await openWithIds(MAX_ENTRIES_PER_SYNC + 5)
        for (let n = 0; n < MAX_ENTRIES_PER_SYNC + 5; n += 1) {
          // oxlint-disable-next-line no-await-in-loop -- the clock and the ids count the calls in order.
          await finishGame(mixed, 'easy', wonGame(60_000), 'generated', ALICE)
        }
        const good = await finishGame(mixed, 'easy', wonGame(50_000), 'generated', ALICE)
        expect(await batchIds(mixed, ALICE)).toEqual([good])
      })
    })
  })
}
