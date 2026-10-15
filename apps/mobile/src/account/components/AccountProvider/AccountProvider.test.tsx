import { ClerkProvider, useAuth, useUser } from '@clerk/expo'
import { resourceCache } from '@clerk/expo/resource-cache'
import { tokenCache } from '@clerk/expo/token-cache'
import { act, render, renderHook, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { useOwner } from '@/storage/hooks/useOwner'
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

function withKey(key: string | null) {
  return ({ children }: { children: ReactNode }) => <AccountProvider publishableKey={key}>{children}</AccountProvider>
}

beforeEach(signedOut)
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
  it('starts Clerk with the key, the Keychain token cache, the resource cache and no telemetry', () => {
    render(
      <AccountProvider publishableKey="pk_test_abc">
        <Text>Play</Text>
      </AccountProvider>,
    )
    expect(screen.getByText('Play')).toBeTruthy()
    expect(jest.mocked(ClerkProvider).mock.calls[0]?.[0]).toMatchObject({
      publishableKey: 'pk_test_abc',
      tokenCache,
      telemetry: false,
      ['__experimental_resourceCache']: resourceCache,
    })
  })

  it('gives the Clerk user ID as the owner, and the email to the account', () => {
    signedIn('user_alice', 'alice@example.com')
    const { result } = renderHook(() => ({ owner: useOwner(), account: useAccount() }), {
      wrapper: withKey('pk_test_abc'),
    })
    expect(result.current.owner).toBe('user_alice')
    expect(result.current.account).toMatchObject({ status: 'signedIn', email: 'alice@example.com' })
  })

  it('gives no owner while Clerk loads, and still renders the children (SUD-01)', () => {
    loading()
    render(
      <AccountProvider publishableKey="pk_test_abc">
        <Text>Play</Text>
      </AccountProvider>,
    )
    expect(screen.getByText('Play')).toBeTruthy()
    const { result } = renderHook(() => ({ owner: useOwner(), account: useAccount() }), {
      wrapper: withKey('pk_test_abc'),
    })
    expect(result.current.owner).toBeNull()
    expect(result.current.account.status).toBe('loading')
  })

  it('gives no owner when signed out', () => {
    const { result } = renderHook(() => ({ owner: useOwner(), account: useAccount() }), {
      wrapper: withKey('pk_test_abc'),
    })
    expect(result.current.owner).toBeNull()
    expect(result.current.account.status).toBe('signedOut')
  })

  it('signs out through Clerk, and the owner goes back to null', async () => {
    const signOut = signedIn('user_alice', 'alice@example.com')
    const { result, rerender } = renderHook(() => ({ owner: useOwner(), account: useAccount() }), {
      wrapper: withKey('pk_test_abc'),
    })
    await act(() => result.current.account.signOut())
    expect(signOut).toHaveBeenCalled()
    signedOut()
    rerender({})
    expect(result.current.owner).toBeNull()
  })
})
