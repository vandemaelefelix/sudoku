import type { GameStorage } from '@/storage'
import { cleanUpDeletedAccount, forgetCleanedUpOwners } from './accountDeleted'
import { ALICE, BOB, createTestStorage, finishGame } from './syncTestKit'

let storage: GameStorage

beforeEach(async () => {
  forgetCleanedUpOwners()
  storage = createTestStorage()
  await finishGame(storage, ALICE)
  await finishGame(storage, BOB)
  await finishGame(storage, null)
  await storage.sync.saveCursor(ALICE, 'c')
  await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
})

it('deletes the entries of the owner, clears the state, signs out and tells the player', async () => {
  const signOut = jest.fn(async () => true)
  const announce = jest.fn()
  await cleanUpDeletedAccount({ history: storage.history, signOut, announce }, ALICE)
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
  await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
  await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
  await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(announce).toHaveBeenCalledTimes(1)
})

it('keeps the entries of another account and of no account', async () => {
  await cleanUpDeletedAccount({ history: storage.history, signOut: async () => true, announce: jest.fn() }, ALICE)
  await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
  await expect(storage.history.list(null)).resolves.toHaveLength(1)
})

it('deletes the data first, so it is gone when Clerk fails to sign out', async () => {
  const signOut = jest.fn(async () => false)
  await cleanUpDeletedAccount({ history: storage.history, signOut, announce: jest.fn() }, ALICE)
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
})

it('cleans up an owner once: a second call, also a parallel one, signs out and alerts nothing', async () => {
  const signOut = jest.fn(async () => true)
  const announce = jest.fn()
  const deps = { history: storage.history, signOut, announce }
  await Promise.all([cleanUpDeletedAccount(deps, ALICE), cleanUpDeletedAccount(deps, ALICE)])
  await cleanUpDeletedAccount(deps, ALICE)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(announce).toHaveBeenCalledTimes(1)
})

it('tries again for an owner whose first cleanup failed', async () => {
  const announce = jest.fn()
  const deps = { history: storage.history, signOut: async () => true, announce }
  jest.spyOn(storage.history, 'deleteOwner').mockRejectedValueOnce(new Error('disk full'))
  await expect(cleanUpDeletedAccount(deps, ALICE)).rejects.toThrow('disk full')
  await cleanUpDeletedAccount(deps, ALICE)
  expect(announce).toHaveBeenCalledTimes(1)
})
