import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { clerkSignedIn, clerkSignedOut } from '@/account/account.testkit'
import { AccountProvider } from '@/account/components/AccountProvider'
import { useApiToken } from './useApiToken'

function Configured({ children }: { children: ReactNode }) {
  return <AccountProvider publishableKey="pk_test_abc">{children}</AccountProvider>
}

beforeEach(() => {
  clerkSignedOut()
})

it('asks Clerk for a sudoku-api token on every call', async () => {
  const getToken = jest.fn(async () => 'token-1')
  clerkSignedIn('user_alice', { getToken })
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
  const getToken = jest.fn(async () => {
    throw new Error('offline')
  })
  clerkSignedIn('user_alice', { getToken })
  const { result } = renderHook(() => useApiToken(), { wrapper: Configured })
  await expect(result.current()).resolves.toBeNull()
})
