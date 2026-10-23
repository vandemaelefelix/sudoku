import type { GameStorage } from '@/storage/gameStorage.types'
import { toWireEntry } from '@/storage/wireEntry'
import {
  ALICE,
  BOB,
  type StorageOpener,
  accepting,
  batchIds,
  finishGame,
  remote,
  sending,
  single,
  testDeps,
  uuid,
  wonGame,
} from './fixtures.testkit'

export function describeApplySyncPage(open: StorageOpener): void {
  describe('applySyncPage', () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    describe('the pushed entries', () => {
      it('takes the accepted entries off the waiting list', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(50_000), 'generated', ALICE)
        const [first, second] = await storage.history.nextBatch(ALICE)
        if (first === undefined || second === undefined) throw new Error('Expected two entries')
        await storage.history.applySyncPage(accepting(ALICE, [first]))
        expect(await batchIds(storage, ALICE)).toEqual([second.id])
        await storage.history.applySyncPage(accepting(ALICE, [second]))
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      })

      it('marks only the entries that the server named, and only the ones that it got', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(50_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(40_000), 'generated', ALICE)
        const sent = await storage.history.nextBatch(ALICE)
        const [first, second, third] = sent
        if (first === undefined || second === undefined || third === undefined) throw new Error('Expected three')
        const acceptedIds = [first.id, third.id, uuid(999)]
        await storage.history.applySyncPage({ ...accepting(ALICE, sent.slice(0, 2)), acceptedIds })
        expect(await batchIds(storage, ALICE)).toEqual([second.id, third.id])
      })

      it('keeps an entry that changed after the push', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.nextBatch(ALICE))
        await storage.history.clear(ALICE)
        await storage.history.applySyncPage(accepting(ALICE, [sent]))
        const left = single(await storage.history.nextBatch(ALICE))
        expect(left).toMatchObject({ id, deletedAt: expect.any(String) })
      })

      it('ignores a repeated page, also after a newer change', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.nextBatch(ALICE))
        await storage.history.applySyncPage(accepting(ALICE, [sent]))
        await storage.history.applySyncPage(accepting(ALICE, [sent]))
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
        await storage.history.clear(ALICE)
        const deleted = single(await storage.history.nextBatch(ALICE))
        await storage.history.applySyncPage(accepting(ALICE, [sent]))
        await expect(storage.history.nextBatch(ALICE)).resolves.toEqual([deleted])
        await storage.history.applySyncPage(accepting(ALICE, [deleted]))
        await storage.history.applySyncPage(accepting(ALICE, [deleted]))
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      })

      it('changes no entry for a page without pushed entries', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await storage.history.applySyncPage(accepting(ALICE, []))
        await expect(storage.history.nextBatch(ALICE)).resolves.toHaveLength(1)
      })
    })

    describe('the downloaded entries', () => {
      it('adds a new entry that is not on the waiting list', async () => {
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { seed: 412_077 })]))
        const {
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          deletedAt: _deletedAt,
          ...entry
        } = remote(1, { seed: 412_077 })
        await expect(storage.history.list(ALICE)).resolves.toEqual([entry])
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
        await expect(storage.history.list(null)).resolves.toEqual([])
      })

      it('replaces an entry with a newer change', async () => {
        await storage.history.applySyncPage(sending(ALICE, [remote(1)]))
        await storage.history.applySyncPage(
          sending(ALICE, [remote(1, { playedMs: 45_000, updatedAt: '2026-10-02T09:00:00.000Z' })]),
        )
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: remote(1).id, playedMs: 45_000 }])
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      })

      it('ignores an older change', async () => {
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { updatedAt: '2026-10-02T09:00:00.000Z' })]))
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { playedMs: 45_000 })]))
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ playedMs: 60_000 }])
      })

      it('ignores a change with the same time', async () => {
        await storage.history.applySyncPage(sending(ALICE, [remote(1)]))
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { playedMs: 45_000 })]))
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ playedMs: 60_000 }])
      })

      it('takes a local entry off the waiting list when the server sends the same change', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.nextBatch(ALICE))
        await storage.history.applySyncPage(sending(ALICE, [{ ...sent, playedMs: 45_000 }]))
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: sent.id, playedMs: 60_000 }])
      })

      it('keeps the waiting list of an entry of another owner with the same change', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
        const sent = single(await storage.history.nextBatch(BOB))
        await storage.history.applySyncPage(sending(ALICE, [sent]))
        await expect(storage.history.nextBatch(BOB)).resolves.toEqual([sent])
      })

      it('removes an entry that the server deleted', async () => {
        await storage.history.applySyncPage(sending(ALICE, [remote(1)]))
        const later = '2026-10-02T09:00:00.000Z'
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { updatedAt: later, deletedAt: later })]))
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.stats.summary(null, { includeScanned: true, owner: ALICE })).resolves.toMatchObject({
          played: 0,
        })
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      })

      it('keeps a deleted entry it did not know, so an older copy does not bring it back', async () => {
        const later = '2026-10-02T09:00:00.000Z'
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { updatedAt: later, deletedAt: later })]))
        await storage.history.applySyncPage(sending(ALICE, [remote(1)]))
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      })

      it('never takes an entry from another owner', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
        await storage.history.applySyncPage(
          sending(ALICE, [{ ...remote(1), id, updatedAt: '2030-01-01T00:00:00.000Z' }]),
        )
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id, playedMs: 60_000 }])
        expect(await batchIds(storage, BOB)).toEqual([id])
      })

      it('changes nothing when the server sends back an entry of this device', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.nextBatch(ALICE))
        await storage.history.applySyncPage(accepting(ALICE, [sent]))
        await storage.history.applySyncPage(sending(ALICE, [sent]))
        await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
      })

      it('lists the entries by the time they finished, whatever the order of the page', async () => {
        await storage.history.applySyncPage(
          sending(ALICE, [
            remote(2, { finishedAt: '2026-10-02T09:00:00.000Z' }),
            remote(3, { finishedAt: '2026-10-03T09:00:00.000Z' }),
            remote(1, { finishedAt: '2026-09-30T09:00:00.000Z' }),
          ]),
        )
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const ids = (await storage.history.list(ALICE)).map((entry) => entry.id)
        expect(ids).toEqual([id, remote(3).id, remote(2).id, remote(1).id])
      })

      it('keeps the newest of two copies in one page', async () => {
        await storage.history.applySyncPage(
          sending(ALICE, [remote(1, { playedMs: 45_000, updatedAt: '2026-10-02T09:00:00.000Z' }), remote(1)]),
        )
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ playedMs: 45_000 }])
      })

      it('clears an entry with a change from a clock ahead of this one, and puts it on the waiting list', async () => {
        const future = '2030-01-01T00:00:00.000Z'
        await storage.history.applySyncPage(sending(ALICE, [remote(1, { updatedAt: future })]))
        await storage.history.clear(ALICE)
        const deleted = single(await storage.history.nextBatch(ALICE))
        expect(deleted).toMatchObject({ id: remote(1).id, deletedAt: expect.any(String) })
        expect(deleted.updatedAt > future).toBe(true)
      })

      it('drops an entry that breaks the sync contract, writes the rest and saves the cursor', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
        const page = sending(ALICE, [remote(1), remote(2)])
        const bad = { ...toWireEntry(remote(3)), level: 'insane' }
        await storage.history.applySyncPage({ ...page, changes: [bad, 'text', ...page.changes], cursor: 'c9' })
        const ids = (await storage.history.list(ALICE)).map((entry) => entry.id)
        expect([...ids].sort()).toEqual([remote(1).id, remote(2).id])
        await expect(storage.sync.cursor(ALICE)).resolves.toBe('c9')
        warn.mockRestore()
      })
    })

    describe('the result', () => {
      it('reports a change for a new entry and for a newer one', async () => {
        const later = remote(1, { playedMs: 45_000, updatedAt: '2026-10-02T09:00:00.000Z' })
        await expect(storage.history.applySyncPage(sending(ALICE, [remote(1)]))).resolves.toMatchObject({
          changed: true,
        })
        await expect(storage.history.applySyncPage(sending(ALICE, [later]))).resolves.toMatchObject({ changed: true })
      })

      it('reports no change for an older copy, a repeat and an echo of a pushed entry', async () => {
        await storage.history.applySyncPage(sending(ALICE, [remote(1)]))
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const echo = single(await storage.history.nextBatch(ALICE))
        await expect(storage.history.applySyncPage(sending(ALICE, [remote(1)]))).resolves.toMatchObject({
          changed: false,
        })
        await expect(
          storage.history.applySyncPage({ ...accepting(ALICE, [echo]), changes: [toWireEntry(echo)] }),
        ).resolves.toMatchObject({ changed: false })
      })

      it('asks for another push while the server takes entries and more wait', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(50_000), 'generated', ALICE)
        const [first, second] = await storage.history.nextBatch(ALICE)
        if (first === undefined || second === undefined) throw new Error('Expected two entries')
        await expect(storage.history.applySyncPage(accepting(ALICE, [first]))).resolves.toMatchObject({
          pushAgain: true,
        })
        await expect(storage.history.applySyncPage(accepting(ALICE, [second]))).resolves.toMatchObject({
          pushAgain: false,
        })
      })

      it('asks for no push when the server took nothing, as at the daily cap', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = await storage.history.nextBatch(ALICE)
        await expect(
          storage.history.applySyncPage({ ...accepting(ALICE, sent), acceptedIds: [] }),
        ).resolves.toMatchObject({ pushAgain: false })
        await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(true)
      })
    })

    it('saves the cursor of the owner with the page', async () => {
      await storage.history.applySyncPage({ ...accepting(ALICE, []), cursor: 'cursor-1' })
      await expect(storage.sync.cursor(ALICE)).resolves.toBe('cursor-1')
      await expect(storage.sync.cursor(BOB)).resolves.toBeNull()
    })
  })
}
