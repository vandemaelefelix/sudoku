import type { GameStorage } from '@/storage'
import { cleanUpDeletedAccount } from './accountDeleted'
import { ALICE, BOB, createTestStorage, finishGame } from './syncTestKit'

let storage: GameStorage

beforeEach(async () => {
  storage = createTestStorage()
  await finishGame(storage, ALICE)
  await finishGame(storage, BOB)
  await finishGame(storage, null)
  await storage.sync.saveCursor(ALICE, 'c')
  await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
  await storage.sync.markAdoptAsked(ALICE)
})

it('deletes the entries of the owner, clears the state, signs out and tells the player', async () => {
  const signOut = jest.fn(async () => true)
  const announce = jest.fn()
  await cleanUpDeletedAccount({ history: storage.history, state: storage.sync, signOut, announce }, ALICE)
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
  await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
  await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
  await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
  await expect(storage.sync.adoptAsked(ALICE)).resolves.toBe(false)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(announce).toHaveBeenCalledTimes(1)
})

it('keeps the entries of another account and of no account', async () => {
  await cleanUpDeletedAccount(
    { history: storage.history, state: storage.sync, signOut: async () => true, announce: jest.fn() },
    ALICE,
  )
  await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
  await expect(storage.history.list(null)).resolves.toHaveLength(1)
})

it('deletes the data first, so it is gone when Clerk fails to sign out', async () => {
  const signOut = jest.fn(async () => false)
  await cleanUpDeletedAccount({ history: storage.history, state: storage.sync, signOut, announce: jest.fn() }, ALICE)
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
})
