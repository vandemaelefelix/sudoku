import { useAuth } from '@clerk/expo'
import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AccountProvider } from '@/account/components/AccountProvider'
import { useApiToken } from './useApiToken'

type AuthResult = ReturnType<typeof useAuth>

function Configured({ children }: { children: ReactNode }) {
  return <AccountProvider publishableKey="pk_test_abc">{children}</AccountProvider>
}

function signedInWith(getToken: jest.Mock) {
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    userId: 'user_alice',
    getToken,
    signOut: jest.fn(),
  } as unknown as AuthResult)
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    getToken: jest.fn(),
    signOut: jest.fn(),
  } as unknown as AuthResult)
})

it('asks Clerk for a sudoku-api token on every call', async () => {
  const getToken = jest.fn(async () => 'token-1')
  signedInWith(getToken)
  const { result } = renderHook(() => useApiToken(), { wrapper: Configured })
  await expect(result.current()).resolves.toBe('token-1')
  await expect(result.current()).resolves.toBe('token-1')
  expect(getToken).toHaveBeenCalledTimes(2)
  expect(getToken).toHaveBeenCalledWith({ template: 'sudoku-api' })
})

it('gives null when signed out', async () => {
  const { result } = renderHook(() => useApiToken(), { wrapper: Configured })
  await expect(result.current()).resolves.toBeNull()
})

it('gives null without a publishable key', async () => {
  const { result } = renderHook(() => useApiToken())
  await expect(result.current()).resolves.toBeNull()
})

it('gives null when Clerk cannot give a token, for example offline', async () => {
  signedInWith(
    jest.fn(async () => {
      throw new Error('offline')
    }),
  )
  const { result } = renderHook(() => useApiToken(), { wrapper: Configured })
  await expect(result.current()).resolves.toBeNull()
})
