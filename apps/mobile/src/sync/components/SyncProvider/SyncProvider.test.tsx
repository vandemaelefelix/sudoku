import { act, render, screen } from '@testing-library/react-native'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import type { ReactElement } from 'react'
import { Alert, AppState, Text } from 'react-native'
import { AccountContext, type Account } from '@/account/hooks/useAccount'
import type { GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { useSync } from '@/sync/hooks/useSync'
import { ALICE, createTestStorage, finishGame, scriptedApi } from '@/sync/syncTestKit'
import type { SyncApi } from '@/sync/syncApi'
import type { SyncApiResult } from '@/sync/sync.types'
import { SyncProvider } from './SyncProvider'

const OK: SyncApiResult = { kind: 'ok', body: { acceptedIds: [], changes: [], cursor: 'c', more: false } }
const ADOPT_TITLE = 'Add the games on this phone to your account?'

let storage: GameStorage
let appStateHandler: ((state: string) => void) | null
let networkHandler: ((state: { isConnected: boolean }) => void) | null

beforeEach(() => {
  storage = createTestStorage()
  appStateHandler = null
  networkHandler = null
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: string) => void) => {
    appStateHandler = handler
    return { remove: jest.fn() }
  }) as never)
  jest.mocked(addNetworkStateListener).mockImplementation(((handler: (state: { isConnected: boolean }) => void) => {
    networkHandler = handler
    return { remove: jest.fn() }
  }) as never)
})

afterEach(() => {
  jest.restoreAllMocks()
})

function accountOf(status: Account['status'], overrides: Partial<Account> = {}): Account {
  return {
    status,
    email: null,
    signOut: jest.fn(async () => true),
    getApiToken: jest.fn(async () => 'token'),
    ...overrides,
  }
}

function Line() {
  const { lastSyncedAt } = useSync()
  return <Text>{lastSyncedAt === null ? 'never synced' : 'synced'}</Text>
}

function tree(account: Account, owner: string | null, api: SyncApi | undefined, apiUrl?: string | null): ReactElement {
  return (
    <AccountContext value={account}>
      <OwnerContext value={owner}>
        <GameStorageContext value={storage}>
          <SyncProvider {...(api === undefined ? {} : { api })} {...(apiUrl === undefined ? {} : { apiUrl })}>
            <Line />
          </SyncProvider>
        </GameStorageContext>
      </OwnerContext>
    </AccountContext>
  )
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

function answerPrompt(label: string) {
  const call = jest.mocked(Alert.alert).mock.calls.find(([title]) => title === ADOPT_TITLE)
  call?.[2]?.find((button) => button.text === label)?.onPress?.()
}

describe('the triggers', () => {
  it('renders the children before any network call', async () => {
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    expect(screen.getByText('never synced')).toBeTruthy()
    expect(requests).toHaveLength(0)
    await settle()
  })

  it('syncs after the sign-in, and the line gets its time', async () => {
    const { api, requests, tokens } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    expect(requests).toHaveLength(1)
    expect(tokens).toEqual(['token'])
    expect(screen.getByText('synced')).toBeTruthy()
  })

  it('syncs when a game ends', async () => {
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    await act(async () => {
      await finishGame(storage, ALICE)
    })
    await settle()
    expect(requests).toHaveLength(2)
  })

  it('syncs when the app comes to the foreground, not when it leaves', async () => {
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    await act(async () => appStateHandler?.('background'))
    await settle()
    expect(requests).toHaveLength(1)
    await act(async () => appStateHandler?.('active'))
    await settle()
    expect(requests).toHaveLength(2)
  })

  it('syncs when the network comes back, not when it stays on', async () => {
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    await act(async () => networkHandler?.({ isConnected: true }))
    await settle()
    expect(requests).toHaveLength(1)
    await act(async () => networkHandler?.({ isConnected: false }))
    await act(async () => networkHandler?.({ isConnected: true }))
    await settle()
    expect(requests).toHaveLength(2)
  })

  it('syncs on the first reconnect after the app started offline', async () => {
    jest.mocked(getNetworkStateAsync).mockResolvedValueOnce({ isConnected: false } as never)
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    expect(requests).toHaveLength(1)
    await act(async () => networkHandler?.({ isConnected: true }))
    await settle()
    expect(requests).toHaveLength(2)
  })

  it('makes no request when signed out', async () => {
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedOut'), null, api))
    await settle()
    await act(async () => appStateHandler?.('active'))
    await act(async () => {
      await finishGame(storage, null)
    })
    await settle()
    expect(requests).toHaveLength(0)
  })

  it('makes no request without an account or without an API URL', async () => {
    const { api, requests } = scriptedApi([OK])
    const first = render(tree(accountOf('unconfigured'), null, api))
    await settle()
    first.unmount()
    render(tree(accountOf('signedIn'), ALICE, undefined, null))
    await settle()
    expect(requests).toHaveLength(0)
    expect(screen.getByText('never synced')).toBeTruthy()
  })
})

describe('the adopt prompt', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  })

  it('asks once with the exact copy and syncs nothing before the answer', async () => {
    await finishGame(storage, null)
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith(
      ADOPT_TITLE,
      'These games were played before you signed in. They will back up to your account and show on your other devices.',
      [expect.objectContaining({ text: 'Not now' }), expect.objectContaining({ text: 'Add games' })],
      { cancelable: false },
    )
    await act(async () => appStateHandler?.('active'))
    await settle()
    expect(requests).toHaveLength(0)
  })

  it('adopts the games on Add games, then syncs them', async () => {
    const id = await finishGame(storage, null)
    const { api, requests } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    await act(async () => answerPrompt('Add games'))
    await settle()
    await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id }])
    expect(requests[0]?.entries).toMatchObject([{ id }])
  })

  it('keeps the games on Not now, remembers it and still syncs', async () => {
    await finishGame(storage, null)
    const { api, requests } = scriptedApi([OK])
    const view = render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    await act(async () => answerPrompt('Not now'))
    await settle()
    await expect(storage.history.list(null)).resolves.toHaveLength(1)
    expect(requests).toHaveLength(1)
    view.unmount()
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    expect(Alert.alert).toHaveBeenCalledTimes(1)
  })

  it('does not ask when no game lacks an owner', async () => {
    const { api } = scriptedApi([OK])
    render(tree(accountOf('signedIn'), ALICE, api))
    await settle()
    expect(Alert.alert).not.toHaveBeenCalled()
  })
})

describe('a deleted account', () => {
  it('deletes the local entries, signs out and tells the player once', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    await finishGame(storage, ALICE)
    const account = accountOf('signedIn')
    const { api } = scriptedApi([{ kind: 'account_deleted' }])
    render(tree(account, ALICE, api))
    await settle()
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
    expect(account.signOut).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith('This account was deleted. You are signed out.')
  })
})
