import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { createAccountLifecycle, type AccountLifecycle } from '@/account/accountLifecycle'
import { memoryOwnerCache } from '@/account/account.testkit'
import { AccountContext, UNCONFIGURED_ACCOUNT, type AccountStatus } from '@/account/hooks/useAccount'
import { AccountLifecycleContext } from '@/account/hooks/useAccountLifecycle'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { useDeleteAccount } from './useDeleteAccount'

function setup(status: AccountStatus, owner: string | null, withLifecycle = true) {
  const lifecycle: AccountLifecycle = {
    canDelete: true,
    deleteAccount: jest.fn(async () => 'deleted' as const),
    onAccountDeleted: jest.fn(async () => undefined),
    forgetLostAttempt: jest.fn(),
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

/** A real lifecycle: the first delete is lost, then Clerk gives no token. `status` is read at each render. */
function lostThenNoToken(initial: AccountStatus = 'signedIn') {
  const tokens = ['t1', null]
  let call = 0
  let status = initial
  const lifecycle = createAccountLifecycle({
    account: {
      getApiToken: async () => tokens[Math.min(call++, tokens.length - 1)] ?? null,
      signOut: async () => true,
      markDeleted: () => undefined,
    },
    api: { deleteAccount: async () => ({ kind: 'offline' }) },
    sync: { pause: async () => undefined, stop: async () => undefined, resume: () => undefined },
    history: { deleteOwner: async () => undefined },
    ownerCache: memoryOwnerCache('user-alice'),
    sleep: async () => undefined,
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, status }}>
      <OwnerContext value="user-alice">
        <AccountLifecycleContext value={lifecycle}>{children}</AccountLifecycleContext>
      </OwnerContext>
    </AccountContext>
  )
  return { wrapper, setStatus: (next: AccountStatus) => (status = next) }
}

describe('the memory of a lost answer', () => {
  it('counts a missing token as a delete inside one open screen', async () => {
    const { wrapper } = lostThenNoToken()
    const view = renderHook(() => useDeleteAccount(), { wrapper })
    await expect(view.result.current()).resolves.toBe('offline')
    await expect(view.result.current()).resolves.toBe('deleted')
  })

  it('forgets the lost answer when the screen goes away', async () => {
    const { wrapper } = lostThenNoToken()
    const first = renderHook(() => useDeleteAccount(), { wrapper })
    await expect(first.result.current()).resolves.toBe('offline')
    first.unmount()
    const second = renderHook(() => useDeleteAccount(), { wrapper })
    await expect(second.result.current()).resolves.toBe('offline')
  })

  it('forgets the lost answer on a sign-out', async () => {
    const { wrapper, setStatus } = lostThenNoToken()
    const view = renderHook(() => useDeleteAccount(), { wrapper })
    await expect(view.result.current()).resolves.toBe('offline')
    setStatus('signedOut')
    view.rerender({})
    setStatus('signedIn')
    view.rerender({})
    await expect(view.result.current()).resolves.toBe('offline')
  })
})
