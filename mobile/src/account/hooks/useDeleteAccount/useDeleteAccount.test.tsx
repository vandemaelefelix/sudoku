import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Alert } from 'react-native'
import { AccountContext, UNCONFIGURED_ACCOUNT, type Account } from '@/account/hooks/useAccount'
import { writeCachedOwner } from '@/account/utils/ownerCache.utils'
import type { GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { SyncControlContext, type SyncControl } from '@/sync/hooks/useSyncControl'
import type { DeleteAccountResult } from '@/sync/sync.types'
import { ALICE, BOB, createTestStorage, finishGame, seedCursor } from '@/sync/syncTestKit'
import { cleanUpDeletedAccount, forgetCleanedUpOwners } from '@/sync/accountDeleted'
import { useDeleteAccount } from './useDeleteAccount'

jest.mock('@/account/utils/ownerCache.utils', () => ({
  readCachedOwner: jest.fn(async () => null),
  writeCachedOwner: jest.fn(async () => undefined),
}))

let storage: GameStorage
let calls: string[]

beforeEach(async () => {
  forgetCleanedUpOwners()
  calls = []
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  storage = createTestStorage()
  await finishGame(storage, ALICE)
  await finishGame(storage, BOB)
  await finishGame(storage, null)
  await seedCursor(storage, ALICE, 'c')
})

afterEach(() => jest.restoreAllMocks())

function setup(
  answers: DeleteAccountResult[],
  {
    signOut = async () => true,
    tokens = ['t1', 't2'],
  }: { signOut?: () => Promise<boolean>; tokens?: (string | null)[] } = {},
) {
  const used: string[] = []
  let call = 0
  let tokenCall = 0
  const control: SyncControl = {
    async deleteAccount(token) {
      calls.push('api')
      used.push(token)
      return answers[Math.min(call++, answers.length - 1)]!
    },
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
  const account: Account = {
    ...UNCONFIGURED_ACCOUNT,
    status: 'signedIn',
    email: 'a@b.c',
    markDeleted: jest.fn(),
    getApiToken: jest.fn(async () => tokens[Math.min(tokenCall++, tokens.length - 1)] ?? null),
    signOut: jest.fn(async () => {
      calls.push('signOut')
      return signOut()
    }),
  }
  const sleep = jest.fn(async () => undefined)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountContext value={account}>
      <OwnerContext value={ALICE}>
        <GameStorageContext value={storage}>
          <SyncControlContext value={control}>{children}</SyncControlContext>
        </GameStorageContext>
      </OwnerContext>
    </AccountContext>
  )
  const { result } = renderHook(() => useDeleteAccount(sleep), { wrapper })
  const run = async () => {
    let outcome: Awaited<ReturnType<typeof result.current>> = 'failed'
    await act(async () => {
      outcome = await result.current()
    })
    return outcome
  }
  return { run, account, used, sleep }
}

it('calls the server with one fresh token, then stops the sync, deletes the local data and signs out', async () => {
  const { run, account, used } = setup([{ kind: 'ok' }])
  await expect(run()).resolves.toBe('deleted')
  expect(account.getApiToken).toHaveBeenCalledWith({ fresh: true })
  expect(used).toEqual(['t1'])
  expect(calls).toEqual(['pause', 'api', 'stop', 'signOut'])
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
  await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
  await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
  await expect(storage.history.list(null)).resolves.toHaveLength(1)
  expect(Alert.alert).toHaveBeenCalledWith('Account deleted', 'Your account and its backed-up games are deleted.')
})

it('stops a pending sync run before it deletes the local data', async () => {
  const { run } = setup([{ kind: 'ok' }])
  const spy = jest.spyOn(storage.history, 'deleteOwner').mockImplementation(async () => {
    calls.push('deleteOwner')
  })
  await run()
  expect(calls).toEqual(['pause', 'api', 'stop', 'deleteOwner', 'signOut'])
  spy.mockRestore()
})

it('changes nothing when the phone is offline', async () => {
  const { run, account } = setup([{ kind: 'offline' }])
  await expect(run()).resolves.toBe('offline')
  expect(calls).toEqual(['pause', 'api', 'api', 'api', 'resume'])
  expect(account.signOut).not.toHaveBeenCalled()
  await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
  await expect(storage.sync.cursor(ALICE)).resolves.toBe('c')
})

it('is offline when Clerk gives no token', async () => {
  const { run } = setup([{ kind: 'ok' }], { tokens: [null] })
  await expect(run()).resolves.toBe('offline')
  expect(calls).toEqual(['pause', 'resume'])
})

it('keeps everything on a server error, after two retries with the same token', async () => {
  const { run, account, used, sleep } = setup([{ kind: 'server_error' }])
  await expect(run()).resolves.toBe('failed')
  expect(used).toEqual(['t1', 't1', 't1'])
  expect(sleep).toHaveBeenCalledWith(1000)
  expect(account.signOut).not.toHaveBeenCalled()
  await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
})

it('succeeds when a retry works', async () => {
  const { run, used } = setup([{ kind: 'server_error' }, { kind: 'ok' }])
  await expect(run()).resolves.toBe('deleted')
  expect(used).toEqual(['t1', 't1'])
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
})

it('asks for a new token once after a 401', async () => {
  const { run, used } = setup([{ kind: 'unauthorized' }, { kind: 'ok' }])
  await expect(run()).resolves.toBe('deleted')
  expect(used).toEqual(['t1', 't2'])
})

it('still deletes the local data, clears the cached owner and forces no owner when the sign-out fails', async () => {
  const { run, account } = setup([{ kind: 'ok' }], { signOut: async () => false })
  await expect(run()).resolves.toBe('deleted')
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
  expect(writeCachedOwner).toHaveBeenCalledWith(null)
  expect(account.markDeleted).toHaveBeenCalledWith({ signedOut: false })
})

it('forces no owner after a good sign-out too', async () => {
  const { run, account } = setup([{ kind: 'ok' }])
  await run()
  expect(account.markDeleted).toHaveBeenCalledWith({ signedOut: true })
})

it('resumes the sync after a failure', async () => {
  const { run } = setup([{ kind: 'server_error' }])
  await run()
  expect(calls.at(-1)).toBe('resume')
})

it('treats a 401 after a lost attempt as a deleted account', async () => {
  const { run, account } = setup([{ kind: 'offline' }, { kind: 'unauthorized' }])
  await expect(run()).resolves.toBe('deleted')
  expect(calls).toEqual(['pause', 'api', 'api', 'stop', 'signOut'])
  expect(account.getApiToken).toHaveBeenCalledTimes(1)
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
  expect(Alert.alert).toHaveBeenCalledWith('Account deleted', 'Your account and its backed-up games are deleted.')
})

it('treats a missing token on a later try after a lost attempt as a deleted account', async () => {
  const { run } = setup([{ kind: 'offline' }], { tokens: ['t1', null] })
  await expect(run()).resolves.toBe('offline')
  await expect(run()).resolves.toBe('deleted')
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
})

it('keeps a 401 on the very first attempt an error', async () => {
  const { run, account } = setup([{ kind: 'unauthorized' }])
  await expect(run()).resolves.toBe('failed')
  expect(account.signOut).not.toHaveBeenCalled()
  await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
})

it('cleans up once when a running sync got the 410 first: one alert, one sign-out', async () => {
  const { run, account } = setup([{ kind: 'ok' }])
  const deps = {
    history: storage.history,
    state: storage.sync,
    signOut: account.signOut,
    announce: () => Alert.alert('x'),
  }
  await cleanUpDeletedAccount(deps, ALICE)
  await run()
  expect(Alert.alert).toHaveBeenCalledTimes(1)
  expect(account.signOut).toHaveBeenCalledTimes(1)
})

const signedOutWrapper = ({ children }: { children: ReactNode }) => (
  <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, status: 'signedOut' }}>{children}</AccountContext>
)

it('does nothing when signed out', async () => {
  const { result } = renderHook(() => useDeleteAccount(), { wrapper: signedOutWrapper })
  await expect(result.current()).resolves.toBe('failed')
})
