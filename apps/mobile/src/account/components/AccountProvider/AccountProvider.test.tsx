import { ClerkProvider, useAuth, useUser } from '@clerk/expo'
import { resourceCache } from '@clerk/expo/resource-cache'
import { tokenCache } from '@clerk/expo/token-cache'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { useOwner } from '@/storage/hooks/useOwner'
import { OWNER_CACHE_KEY } from '@/account/constants/account.constants'
import { AccountProvider } from './AccountProvider'

type AuthResult = ReturnType<typeof useAuth>
type UserResult = ReturnType<typeof useUser>

function signedIn(userId: string, email: string) {
  const signOut = jest.fn(async () => undefined)
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    userId,
    getToken: jest.fn(),
    signOut,
  } as unknown as AuthResult)
  jest.mocked(useUser).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    user: { primaryEmailAddress: { emailAddress: email } },
  } as unknown as UserResult)
  return signOut
}

function signedOut() {
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    getToken: jest.fn(),
    signOut: jest.fn(),
  } as unknown as AuthResult)
  jest.mocked(useUser).mockReturnValue({ isLoaded: true, isSignedIn: false, user: null } as UserResult)
}

function loading() {
  jest
    .mocked(useAuth)
    .mockReturnValue({ isLoaded: false, isSignedIn: undefined, userId: undefined } as unknown as AuthResult)
  jest.mocked(useUser).mockReturnValue({ isLoaded: false, isSignedIn: undefined, user: undefined } as UserResult)
}

async function renderAccount() {
  const view = renderHook(() => ({ owner: useOwner(), account: useAccount() }), { wrapper: withKey('pk_test_abc') })
  // The provider renders its children after the Keychain read, so the hook result starts as null.
  await waitFor(() => expect(view.result.current).not.toBeNull())
  return view
}

function withKey(key: string | null) {
  return ({ children }: { children: ReactNode }) => <AccountProvider publishableKey={key}>{children}</AccountProvider>
}

beforeEach(() => {
  signedOut()
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null)
  jest.mocked(SecureStore.setItemAsync).mockClear()
  jest.mocked(SecureStore.deleteItemAsync).mockClear()
})
afterEach(() => jest.mocked(ClerkProvider).mockClear())

describe('without a publishable key', () => {
  it('renders the children without Clerk and gives no owner', () => {
    render(
      <AccountProvider publishableKey={null}>
        <Text>Play</Text>
      </AccountProvider>,
    )
    expect(screen.getByText('Play')).toBeTruthy()
    expect(ClerkProvider).not.toHaveBeenCalled()
    const { result } = renderHook(() => ({ owner: useOwner(), account: useAccount() }), { wrapper: withKey(null) })
    expect(result.current.owner).toBeNull()
    expect(result.current.account.status).toBe('unconfigured')
  })
})

describe('with a publishable key', () => {
  it('starts Clerk with the key, the Keychain token cache, the resource cache and no telemetry', async () => {
    render(
      <AccountProvider publishableKey="pk_test_abc">
        <Text>Play</Text>
      </AccountProvider>,
    )
    expect(await screen.findByText('Play')).toBeTruthy()
    expect(jest.mocked(ClerkProvider).mock.calls[0]?.[0]).toMatchObject({
      publishableKey: 'pk_test_abc',
      tokenCache,
      telemetry: false,
      ['__experimental_resourceCache']: resourceCache,
    })
  })

  it('gives the Clerk user ID as the owner, and the email to the account', async () => {
    signedIn('user_alice', 'alice@example.com')
    const { result } = await renderAccount()
    expect(result.current.owner).toBe('user_alice')
    expect(result.current.account).toMatchObject({ status: 'signedIn', email: 'alice@example.com' })
  })

  it('gives no owner while Clerk loads without a cached ID, and still renders the children (SUD-01)', async () => {
    loading()
    render(
      <AccountProvider publishableKey="pk_test_abc">
        <Text>Play</Text>
      </AccountProvider>,
    )
    expect(await screen.findByText('Play')).toBeTruthy()
    const { result } = await renderAccount()
    expect(result.current.owner).toBeNull()
    expect(result.current.account.status).toBe('loading')
  })

  it('gives no owner when signed out', async () => {
    const { result } = await renderAccount()
    expect(result.current.owner).toBeNull()
    expect(result.current.account.status).toBe('signedOut')
  })

  it('signs out through Clerk, and the owner goes back to null', async () => {
    const signOut = signedIn('user_alice', 'alice@example.com')
    const { result, rerender } = await renderAccount()
    await act(async () => {
      expect(await result.current.account.signOut()).toBe(true)
    })
    expect(signOut).toHaveBeenCalled()
    signedOut()
    rerender({})
    expect(result.current.owner).toBeNull()
  })

  it('catches a failed sign-out, reports it as false and warns without the player data', async () => {
    const signOut = signedIn('user_alice', 'alice@example.com')
    signOut.mockRejectedValueOnce(new Error('network down'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { result } = await renderAccount()
    let done: boolean | undefined
    await act(async () => {
      done = await result.current.account.signOut()
    })
    expect(done).toBe(false)
    expect(warn).toHaveBeenCalledWith('[account] Clerk did not sign out: network down')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('alice@example.com')
    expect(result.current.owner).toBe('user_alice')
    warn.mockRestore()
  })
})

describe('the owner before Clerk has loaded (ADR-028)', () => {
  it('uses the cached Clerk user ID while Clerk loads', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('user_cached')
    loading()
    const { result } = await renderAccount()
    expect(result.current.owner).toBe('user_cached')
    expect(result.current.account.status).toBe('loading')
  })

  it('renders the children once the Keychain is read, and never waits for Clerk (SUD-01)', async () => {
    loading()
    render(
      <AccountProvider publishableKey="pk_test_abc">
        <Text>Play</Text>
      </AccountProvider>,
    )
    expect(await screen.findByText('Play')).toBeTruthy()
  })

  it('renders the children without an owner when the Keychain read fails', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('locked'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    loading()
    const { result } = await renderAccount()
    expect(result.current.owner).toBeNull()
    warn.mockRestore()
  })

  it('stores the user ID when Clerk loads signed in, and uses it', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('user_old')
    signedIn('user_alice', 'alice@example.com')
    const { result } = await renderAccount()
    expect(result.current.owner).toBe('user_alice')
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith(OWNER_CACHE_KEY, 'user_alice'))
  })

  it('clears the cache and gives no owner when Clerk loads signed out', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('user_cached')
    signedOut()
    const { result } = await renderAccount()
    expect(result.current.owner).toBeNull()
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(OWNER_CACHE_KEY))
  })

  it('clears the cache when the player signs out', async () => {
    signedIn('user_alice', 'alice@example.com')
    const { rerender } = await renderAccount()
    jest.mocked(SecureStore.deleteItemAsync).mockClear()
    signedOut()
    rerender({})
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(OWNER_CACHE_KEY))
  })
})
