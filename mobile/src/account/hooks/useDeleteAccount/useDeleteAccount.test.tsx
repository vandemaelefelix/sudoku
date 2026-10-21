import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import type { AccountLifecycle } from '@/account/accountLifecycle'
import { AccountContext, UNCONFIGURED_ACCOUNT, type AccountStatus } from '@/account/hooks/useAccount'
import { AccountLifecycleContext } from '@/account/hooks/useAccountLifecycle'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { useDeleteAccount } from './useDeleteAccount'

function setup(status: AccountStatus, owner: string | null, withLifecycle = true) {
  const lifecycle: AccountLifecycle = {
    canDelete: true,
    deleteAccount: jest.fn(async () => 'deleted' as const),
    onAccountDeleted: jest.fn(async () => undefined),
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, status }}>
      <OwnerContext value={owner}>
        <AccountLifecycleContext value={withLifecycle ? lifecycle : null}>{children}</AccountLifecycleContext>
      </OwnerContext>
    </AccountContext>
  )
  const { result } = renderHook(() => useDeleteAccount(), { wrapper })
  return { run: () => result.current(), lifecycle }
}

it('asks the lifecycle to delete the account of the signed-in owner', async () => {
  const { run, lifecycle } = setup('signedIn', 'user-alice')
  await expect(run()).resolves.toBe('deleted')
  expect(lifecycle.deleteAccount).toHaveBeenCalledWith('user-alice')
})

it.each([
  ['signed out', 'signedOut', 'user-alice', true],
  ['without an owner', 'signedIn', null, true],
  ['without a lifecycle', 'signedIn', 'user-alice', false],
] as const)('answers failed and asks nothing %s', async (_name, status, owner, withLifecycle) => {
  const { run, lifecycle } = setup(status, owner, withLifecycle)
  await expect(run()).resolves.toBe('failed')
  expect(lifecycle.deleteAccount).not.toHaveBeenCalled()
})
