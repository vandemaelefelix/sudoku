import { Alert } from 'react-native'
import { memoryOwnerCache } from '@/account/account.testkit'
import type { Account } from '@/account/hooks/useAccount'
import type { GameStorage } from '@/storage'
import { createAppSync } from './createAppSync'
import type { AccountApi } from './syncApi'
import type { SyncApiResult } from './sync.types'
import type { SyncSession } from './sync.types'
import { ALICE, BOB, createTestStorage, finishGame, noSleep, scriptedApi, seedCursor } from './sync.testkit'

let storage: GameStorage

beforeEach(async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  storage = createTestStorage()
  await finishGame(storage, ALICE)
  await finishGame(storage, BOB)
  await seedCursor(storage, ALICE, 'c')
})

afterEach(() => jest.restoreAllMocks())

const OK: SyncApiResult = { kind: 'ok', body: { acceptedIds: [], changes: [], cursor: 'c', more: false } }

function setup(
  syncAnswers: SyncApiResult[],
  deleteAnswer: Awaited<ReturnType<AccountApi['deleteAccount']>> = { kind: 'ok' },
) {
  const account: Pick<Account, 'getApiToken' | 'signOut' | 'markDeleted'> = {
    getApiToken: jest.fn(async () => 'token'),
    signOut: jest.fn(async () => true),
    markDeleted: jest.fn(),
  }
  const accountApi: AccountApi = { deleteAccount: jest.fn(async () => deleteAnswer) }
  const ownerCache = memoryOwnerCache(ALICE)
  const { api, requests } = scriptedApi(syncAnswers)
  const app = createAppSync({
    storage,
    api,
    accountApi,
    account,
    ownerCache,
    now: () => '2026-10-21T10:00:00.000Z',
    sleep: noSleep,
  })
  const session: SyncSession = { owner: ALICE, getToken: async () => 'token', isCurrent: () => true }
  return { ...app, account, accountApi, ownerCache, requests, session }
}

describe('the 410 path', () => {
  it('cleans up the local data of the owner when a sync run gets 410', async () => {
    const { service, account, session, ownerCache } = setup([{ kind: 'account_deleted' }])
    service.setSession(session)
    await expect(service.trigger('sign-in')).resolves.toBe('deleted')
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    await expect(storage.history.list(BOB)).resolves.toHaveLength(1)
    await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
    expect(account.signOut).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith('This account was deleted. You are signed out.')
    expect(ownerCache.current()).toBe(ALICE)
  })

  it('stays stopped for that owner: a later trigger makes no request', async () => {
    const { service, session, requests } = setup([{ kind: 'account_deleted' }])
    service.setSession(session)
    await service.trigger('sign-in')
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    expect(requests).toHaveLength(1)
  })

  it('still ends the run when the cleanup fails', async () => {
    const { service, session } = setup([{ kind: 'account_deleted' }])
    jest.spyOn(storage.history, 'deleteOwner').mockRejectedValue(new Error('disk full'))
    service.setSession(session)
    await expect(service.trigger('sign-in')).resolves.toBe('deleted')
    expect(Alert.alert).not.toHaveBeenCalled()
  })
})

describe('a delete through the lifecycle', () => {
  it('pauses the service, calls the API, stops the service and cleans up, so no run starts again', async () => {
    const { service, lifecycle, accountApi, account, session, ownerCache, requests } = setup([OK])
    service.setSession(session)
    await service.trigger('sign-in')
    expect(requests).toHaveLength(1)
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('deleted')
    expect(accountApi.deleteAccount).toHaveBeenCalledWith('token')
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    expect(account.markDeleted).toHaveBeenCalledTimes(1)
    expect(ownerCache.current()).toBeNull()
    await expect(service.trigger('foreground')).resolves.toBe('ignored')
    expect(requests).toHaveLength(1)
  })

  it('lets the sync run again after a delete that did not happen', async () => {
    const { service, lifecycle, session, requests } = setup([OK], { kind: 'server_error' })
    service.setSession(session)
    await expect(lifecycle.deleteAccount(ALICE)).resolves.toBe('failed')
    await service.trigger('foreground')
    expect(requests).toHaveLength(1)
    await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
  })
})
