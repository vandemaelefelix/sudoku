import { Alert } from 'react-native'
import type { Account } from '@/account/hooks/useAccount'
import type { GameStorage } from '@/storage'
import type { DeleteAccountResult } from '@/sync/sync.types'
import type { AccountApi } from '@/sync/syncApi'
import { ALICE, BOB, createTestStorage, finishGame, seedCursor } from '@/sync/syncTestKit'
import { memoryOwnerCache } from './accountTestKit'
import { createAccountLifecycle, resumePendingSignOut } from './accountLifecycle'

let storage: GameStorage
let calls: string[]

beforeEach(async () => {
  calls = []
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  storage = createTestStorage()
  await finishGame(storage, ALICE)
  await finishGame(storage, BOB)
  await finishGame(storage, null)
  await seedCursor(storage, ALICE, 'c')
  await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
})

afterEach(() => jest.restoreAllMocks())

const DELETED = ['Account deleted', 'Your account and its backed-up games are deleted.'] as const

/** The fakes: Clerk (the account), the sync, the API and the Keychain. The memory storage is the real repository. */
function setup(
  answers: DeleteAccountResult[],
  {
    signOut = async () => true,
    tokens = ['t1', 't2'],
    api: withApi = true,
  }: { signOut?: () => Promise<boolean>; tokens?: (string | null)[]; api?: boolean } = {},
) {
  const used: string[] = []
  let call = 0
  let tokenCall = 0
  const api: AccountApi = {
    async deleteAccount(token) {
      calls.push('api')
      used.push(token)
      return answers[Math.min(call++, answers.length - 1)]!
    },
  }
  const account: Pick<Account, 'getApiToken' | 'signOut' | 'markDeleted'> = {
    getApiToken: jest.fn(async () => tokens[Math.min(tokenCall++, tokens.length - 1)] ?? null),
    signOut: jest.fn(async () => {
      calls.push('signOut')
      return signOut()
    }),
    markDeleted: jest.fn(() => {
      calls.push('markDeleted')
    }),
  }
  const sync = {
    async stop() {
      calls.push('stop')
    },
    async pause() {
      calls.push('pause')
    },
    resume() {
      calls.push('resume')
    },
  }
  const ownerCache = memoryOwnerCache(ALICE)
  const sleep = jest.fn(async () => undefined)
  const lifecycle = createAccountLifecycle({
    account,
    api: withApi ? api : null,
    sync,
    history: storage.history,
    ownerCache,
    sleep,
  })
  return { lifecycle, account, ownerCache, used, sleep }
}

describe('delete the account', () => {
  it('asks the server with one fresh token, then stops the sync, deletes the local data and signs out', async () => {
    const { lifecycle, account, ownerCache, used } = setup([{ kind: 'ok' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(account.getApiToken).toHaveBeenCalledWith({ fresh: true })
    expect(used).toEqual(['t1'])
    expect(calls).toEqual(['pause', 'api', 'stop', 'signOut', 'markDeleted'])
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
    await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
    await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
    await expect(storage.history.list(null)).resolves.toHaveLength(1)
    expect(ownerCache.current()).toBeNull()
    expect(ownerCache.isPending()).toBe(false)
    expect(Alert.alert).toHaveBeenCalledWith(...DELETED)
  })

  it('stops a pending sync run before it deletes the local data', async () => {
    const { lifecycle } = setup([{ kind: 'ok' }])
    jest.spyOn(storage.history, 'deleteOwner').mockImplementation(async () => {
      calls.push('deleteOwner')
    })
    await lifecycle.deleteAccount(ALICE)
    expect(calls).toEqual(['pause', 'api', 'stop', 'deleteOwner', 'signOut', 'markDeleted'])
  })

  it('changes nothing when the phone is offline', async () => {
    const { lifecycle, account, ownerCache } = setup([{ kind: 'offline' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('offline')
    expect(calls).toEqual(['pause', 'api', 'api', 'api', 'resume'])
    expect(account.signOut).not.toHaveBeenCalled()
    expect(account.markDeleted).not.toHaveBeenCalled()
    expect(ownerCache.current()).toBe(ALICE)
    await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
    await expect(storage.sync.cursor(ALICE)).resolves.toBe('c')
  })

  it('is offline when Clerk gives no token', async () => {
    const { lifecycle } = setup([{ kind: 'ok' }], { tokens: [null] })
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('offline')
    expect(calls).toEqual(['pause', 'resume'])
  })

  it('keeps everything on a server error, after two retries with the same token', async () => {
    const { lifecycle, account, used, sleep } = setup([{ kind: 'server_error' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('failed')
    expect(used).toEqual(['t1', 't1', 't1'])
    expect(sleep).toHaveBeenCalledWith(1000)
    expect(account.signOut).not.toHaveBeenCalled()
    await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
    expect(calls.at(-1)).toBe('resume')
  })

  it('succeeds when a retry works', async () => {
    const { lifecycle, used } = setup([{ kind: 'server_error' }, { kind: 'ok' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(used).toEqual(['t1', 't1'])
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
  })

  it('asks for a new token once after a 401', async () => {
    const { lifecycle, used } = setup([{ kind: 'unauthorized' }, { kind: 'ok' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(used).toEqual(['t1', 't2'])
  })

  it('keeps a 401 on the very first attempt an error', async () => {
    const { lifecycle, account } = setup([{ kind: 'unauthorized' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('failed')
    expect(account.signOut).not.toHaveBeenCalled()
    await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
  })

  it('still deletes the local data and sets the pending sign-out when Clerk fails to sign out', async () => {
    const { lifecycle, ownerCache } = setup([{ kind: 'ok' }], { signOut: async () => false })
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    expect(ownerCache.current()).toBeNull()
    expect(ownerCache.isPending()).toBe(true)
    expect(calls.at(-1)).toBe('markDeleted')
  })

  it('signs out and marks the account deleted also when the local data is not deleted', async () => {
    const { lifecycle, account, ownerCache } = setup([{ kind: 'ok' }])
    jest.spyOn(storage.history, 'deleteOwner').mockRejectedValue(new Error('disk full'))
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(account.signOut).toHaveBeenCalledTimes(1)
    expect(account.markDeleted).toHaveBeenCalledTimes(1)
    expect(ownerCache.current()).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      '[account] The local data of the deleted account was not cleaned up: disk full',
    )
  })

  it('answers failed in a build without an API to call, and touches nothing', async () => {
    const { lifecycle } = setup([{ kind: 'ok' }], { api: false })
    expect(lifecycle.canDelete).toBe(false)
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('failed')
    expect(calls).toEqual([])
  })
})

describe('a lost answer counts as a delete (ADR-028)', () => {
  it('treats a 401 after a lost attempt as a deleted account', async () => {
    const { lifecycle, account } = setup([{ kind: 'offline' }, { kind: 'unauthorized' }])
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(calls).toEqual(['pause', 'api', 'api', 'stop', 'signOut', 'markDeleted'])
    expect(account.getApiToken).toHaveBeenCalledTimes(1)
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    expect(Alert.alert).toHaveBeenCalledWith(...DELETED)
  })

  it('treats a missing token on a later try after a lost attempt as a deleted account', async () => {
    const { lifecycle } = setup([{ kind: 'offline' }], { tokens: ['t1', null] })
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('offline')
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
  })

  it('remembers the lost attempt for its owner only', async () => {
    const { lifecycle } = setup([{ kind: 'offline' }], { tokens: ['t1', null] })
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('offline')
    await expect(lifecycle.deleteAccount(BOB)).resolves.toBe('offline')
    await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
  })
})

describe('410 account_deleted', () => {
  it('deletes the entries and the sync state of the owner, signs out and tells the player', async () => {
    const { lifecycle, account } = setup([{ kind: 'ok' }])
    await lifecycle.onAccountDeleted(ALICE)
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    await expect(storage.history.hasWaiting(ALICE)).resolves.toBe(false)
    await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
    await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
    expect(account.signOut).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith('This account was deleted. You are signed out.')
  })

  it('keeps the entries of another account and of no account', async () => {
    const { lifecycle } = setup([{ kind: 'ok' }])
    await lifecycle.onAccountDeleted(ALICE)
    await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
    await expect(storage.history.list(null)).resolves.toHaveLength(1)
  })

  it('deletes the data first, so it is gone when Clerk fails to sign out', async () => {
    const { lifecycle } = setup([{ kind: 'ok' }], { signOut: async () => false })
    await lifecycle.onAccountDeleted(ALICE)
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
  })

  it('cleans up an owner once: a second call, also a parallel one, signs out and alerts nothing', async () => {
    const { lifecycle, account } = setup([{ kind: 'ok' }])
    await Promise.all([lifecycle.onAccountDeleted(ALICE), lifecycle.onAccountDeleted(ALICE)])
    await lifecycle.onAccountDeleted(ALICE)
    expect(account.signOut).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledTimes(1)
  })

  it('tries again for an owner whose first cleanup failed', async () => {
    const { lifecycle } = setup([{ kind: 'ok' }])
    jest.spyOn(storage.history, 'deleteOwner').mockRejectedValueOnce(new Error('disk full'))
    await expect(lifecycle.onAccountDeleted(ALICE)).rejects.toThrow('disk full')
    await lifecycle.onAccountDeleted(ALICE)
    expect(Alert.alert).toHaveBeenCalledTimes(1)
  })

  it('cleans up once when a sync run got the 410 before the delete: one alert, one sign-out', async () => {
    const { lifecycle, account } = setup([{ kind: 'ok' }])
    await lifecycle.onAccountDeleted(ALICE)
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(account.signOut).toHaveBeenCalledTimes(1)
    expect(account.markDeleted).toHaveBeenCalledTimes(1)
  })

  it('cleans up again for a second owner of the same session', async () => {
    const { lifecycle, account } = setup([{ kind: 'ok' }])
    await lifecycle.onAccountDeleted(ALICE)
    await lifecycle.onAccountDeleted(BOB)
    expect(account.signOut).toHaveBeenCalledTimes(2)
    await expect(storage.history.list(BOB)).resolves.toEqual([])
  })
})

const clerkOf = (signOut: () => Promise<boolean>) => ({ signOut: jest.fn(signOut) })

describe('resumePendingSignOut', () => {
  it('does nothing when no sign-out is pending', async () => {
    const ownerCache = memoryOwnerCache(ALICE)
    const clerk = clerkOf(async () => true)
    const onPending = jest.fn()
    await resumePendingSignOut({ ownerCache, clerk, clerkSignedOut: false, onPending })
    expect(onPending).not.toHaveBeenCalled()
    expect(clerk.signOut).not.toHaveBeenCalled()
  })

  it('signs out again, tells the session first, and forgets the flag', async () => {
    const ownerCache = memoryOwnerCache()
    await ownerCache.setPendingSignOut(true)
    const clerk = clerkOf(async () => true)
    const onPending = jest.fn(() => calls.push('pending'))
    clerk.signOut.mockImplementation(async () => {
      calls.push('signOut')
      return true
    })
    await resumePendingSignOut({ ownerCache, clerk, clerkSignedOut: false, onPending })
    expect(calls).toEqual(['pending', 'signOut'])
    expect(ownerCache.isPending()).toBe(false)
  })

  it('keeps the flag when the sign-out fails again', async () => {
    const ownerCache = memoryOwnerCache()
    await ownerCache.setPendingSignOut(true)
    await resumePendingSignOut({
      ownerCache,
      clerk: clerkOf(async () => false),
      clerkSignedOut: false,
      onPending: jest.fn(),
    })
    expect(ownerCache.isPending()).toBe(true)
  })

  it('forgets the flag without a sign-out when Clerk has no user', async () => {
    const ownerCache = memoryOwnerCache()
    await ownerCache.setPendingSignOut(true)
    const clerk = clerkOf(async () => true)
    await resumePendingSignOut({ ownerCache, clerk, clerkSignedOut: true, onPending: jest.fn() })
    expect(clerk.signOut).not.toHaveBeenCalled()
    expect(ownerCache.isPending()).toBe(false)
  })
})
