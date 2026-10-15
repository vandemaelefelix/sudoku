import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { OwnerContext, useOwner } from './useOwner'

function SignedIn({ children }: { children: ReactNode }) {
  return <OwnerContext value="user-alice">{children}</OwnerContext>
}

it('gives no owner without a provider: the player is signed out', () => {
  const { result } = renderHook(() => useOwner())
  expect(result.current).toBeNull()
})

it('gives the owner of the provider', () => {
  const { result } = renderHook(() => useOwner(), { wrapper: SignedIn })
  expect(result.current).toBe('user-alice')
})
