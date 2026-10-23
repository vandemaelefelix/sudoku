import { getNetworkStateAsync } from 'expo-network'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Alert, type AlertButton } from 'react-native'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { AccountLifecycleContext } from '@/account/hooks/useAccountLifecycle'
import { createAccountLifecycle } from '@/account/accountLifecycle'
import { memoryOwnerCache } from '@/account/account.testkit'
import type { DeleteAccountResult } from '@/sync/sync.types'
import type { AccountApi } from '@/sync/syncApi'
import { ALICE, createTestStorage, finishGame } from '@/sync/sync.testkit'
import { AccountContext, UNCONFIGURED_ACCOUNT, type Account } from '@/account/hooks/useAccount'
import { AccountSection } from './AccountSection'

function withAccount(account: Partial<Account>) {
  return ({ children }: { children: ReactNode }) => (
    <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, ...account }}>{children}</AccountContext>
  )
}

it('is not rendered when the build has no account', () => {
  const view = render(<AccountSection onSignIn={jest.fn()} />)
  expect(view.toJSON()).toBeNull()
})

it('shows one muted line while Clerk loads', () => {
  render(<AccountSection onSignIn={jest.fn()} />, { wrapper: withAccount({ status: 'loading' }) })
  expect(screen.getByRole('header', { name: 'Account' })).toBeTruthy()
  expect(screen.getByText('Checking the account…')).toBeTruthy()
})

it('offers sign-in when signed out', () => {
  const onSignIn = jest.fn()
  render(<AccountSection onSignIn={onSignIn} />, { wrapper: withAccount({ status: 'signedOut' }) })
  expect(screen.getByText('Back up your games across devices.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
  expect(onSignIn).toHaveBeenCalled()
})

function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

describe('signed in', () => {
  afterEach(() => jest.restoreAllMocks())

  it('shows the email and a sign-out row', () => {
    render(<AccountSection onSignIn={jest.fn()} />, {
      wrapper: withAccount({ status: 'signedIn', email: 'alice@example.com' }),
    })
    expect(screen.getByText('alice@example.com')).toBeTruthy()
    expect(screen.getByLabelText('Signed in as alice@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('asks first, and signs out on the destructive answer', async () => {
    const signOut = jest.fn(async () => true)
    const alert = answerAlert('Sign out')
    render(<AccountSection onSignIn={jest.fn()} />, {
      wrapper: withAccount({ status: 'signedIn', email: 'alice@example.com', signOut }),
    })
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign out' })))
    expect(alert).toHaveBeenCalledWith(
      'Sign out?',
      'The games of this account stay on this iPhone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Sign out', style: 'destructive' }),
      ]),
    )
    expect(signOut).toHaveBeenCalled()
  })

  it('stays signed in on Cancel', async () => {
    const signOut = jest.fn(async () => true)
    answerAlert('Cancel')
    render(<AccountSection onSignIn={jest.fn()} />, {
      wrapper: withAccount({ status: 'signedIn', email: 'alice@example.com', signOut }),
    })
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign out' })))
    expect(signOut).not.toHaveBeenCalled()
  })

  it('tells the player in plain words when the sign-out fails, and stays signed in', async () => {
    const signOut = jest.fn(async () => false)
    const alert = answerAlert('Sign out')
    render(<AccountSection onSignIn={jest.fn()} />, {
      wrapper: withAccount({ status: 'signedIn', email: 'alice@example.com', signOut }),
    })
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign out' })))
    expect(alert).toHaveBeenLastCalledWith('Could not sign out', 'Check your connection and try again.')
  })

  it('does not warn about a sign-out that works', async () => {
    const alert = answerAlert('Sign out')
    render(<AccountSection onSignIn={jest.fn()} />, {
      wrapper: withAccount({ status: 'signedIn', email: 'a@b.c', signOut: jest.fn(async () => true) }),
    })
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign out' })))
    expect(alert).toHaveBeenCalledTimes(1)
  })
})

const DELETE_MESSAGE =
  'This deletes your account and the games backed up to it. The games on this iPhone that belong to the account are deleted too. You cannot undo this.'

async function setup(result: DeleteAccountResult | Promise<DeleteAccountResult>, { withControl = true } = {}) {
  const storage = createTestStorage()
  await finishGame(storage, ALICE)
  const control: AccountApi = { deleteAccount: jest.fn(async () => result) }
  const signOut = jest.fn(async () => true)
  const account: Account = {
    ...UNCONFIGURED_ACCOUNT,
    status: 'signedIn',
    email: 'alice@example.com',
    signOut,
    markDeleted: jest.fn(),
    getApiToken: jest.fn(async () => 'token'),
  }
  const lifecycle = createAccountLifecycle({
    account,
    api: withControl ? control : null,
    sync: { pause: async () => undefined, stop: async () => undefined, resume: () => undefined },
    history: storage.history,
    ownerCache: memoryOwnerCache(ALICE),
    sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  })
  render(<AccountSection onSignIn={jest.fn()} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AccountContext value={account}>
        <OwnerContext value={ALICE}>
          <AccountLifecycleContext value={lifecycle}>{children}</AccountLifecycleContext>
        </OwnerContext>
      </AccountContext>
    ),
  })
  return { storage, control, signOut }
}

const press = () => act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete account' })))

describe('delete account', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it('shows a destructive row only when signed in', () => {
    render(<AccountSection onSignIn={jest.fn()} />, { wrapper: withAccount({ status: 'signedOut' }) })
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull()
  })

  it('has an accessible button, enabled at rest', async () => {
    await setup({ kind: 'ok' })
    const row = screen.getByRole('button', { name: 'Delete account' })
    expect(row.props.accessibilityState).toEqual({ disabled: false })
  })

  it('describes what the row does', async () => {
    await setup({ kind: 'ok' })
    expect(screen.getByRole('button', { name: 'Delete account' }).props.accessibilityHint).toBe(
      'Deletes your account and its backed-up games',
    )
  })

  it('has no delete row when the build has no API to call', async () => {
    await setup({ kind: 'ok' }, { withControl: false })
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('says the server could not be reached when the network is up but the token fails', async () => {
    const { control } = await setup({ kind: 'ok' })
    ;(control.deleteAccount as jest.Mock).mockResolvedValue({ kind: 'offline' })
    const alert = answerAlert('Delete account')
    jest.useFakeTimers()
    const done = press()
    await act(async () => jest.advanceTimersByTimeAsync(5_000))
    await done
    jest.useRealTimers()
    expect(alert).toHaveBeenLastCalledWith('Could not delete the account', 'Could not reach the server. Try again.')
  })

  it('asks with the exact words, and does nothing on Cancel', async () => {
    const { control } = await setup({ kind: 'ok' })
    const alert = answerAlert('Cancel')
    await press()
    expect(alert).toHaveBeenCalledWith('Delete account?', DELETE_MESSAGE, [
      expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      expect.objectContaining({ text: 'Delete account', style: 'destructive' }),
    ])
    expect(control.deleteAccount).not.toHaveBeenCalled()
  })

  it('deletes the account and signs out on the destructive answer', async () => {
    const { control, signOut, storage } = await setup({ kind: 'ok' })
    answerAlert('Delete account')
    await press()
    expect(control.deleteAccount).toHaveBeenCalledWith('token')
    expect(signOut).toHaveBeenCalledTimes(1)
    await expect(storage.history.list(ALICE)).resolves.toEqual([])
  })

  it('tells the player when the phone is offline, and keeps everything', async () => {
    jest.mocked(getNetworkStateAsync).mockResolvedValueOnce({ isConnected: false })
    const { signOut, storage } = await setup({ kind: 'offline' })
    const alert = answerAlert('Delete account')
    jest.useFakeTimers()
    const done = press()
    await act(async () => jest.advanceTimersByTimeAsync(5_000))
    await done
    jest.useRealTimers()
    expect(alert).toHaveBeenLastCalledWith(
      'Could not delete the account',
      'Deleting needs the internet. Check your connection and try again.',
    )
    expect(signOut).not.toHaveBeenCalled()
    await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
  })

  it('tells the player when the server fails, and keeps everything', async () => {
    const { signOut } = await setup({ kind: 'unauthorized' })
    const alert = answerAlert('Delete account')
    await press()
    expect(alert).toHaveBeenLastCalledWith(
      'Could not delete the account',
      'Something went wrong. Your account is not deleted. Try again.',
    )
    expect(signOut).not.toHaveBeenCalled()
  })

  it('disables both rows and shows a hint while it deletes, and takes one tap only', async () => {
    let resolveGate!: (result: DeleteAccountResult) => void
    const gate = {
      promise: new Promise<DeleteAccountResult>((resolve) => (resolveGate = resolve)),
      resolve: (result: DeleteAccountResult) => resolveGate(result),
    }
    const { control } = await setup(gate.promise)
    answerAlert('Delete account')
    await press()
    expect(screen.getByText('Deleting the account…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete account' }).props.accessibilityState).toEqual({ disabled: true })
    expect(screen.getByRole('button', { name: 'Sign out' }).props.accessibilityState).toEqual({ disabled: true })
    await press()
    expect(control.deleteAccount).toHaveBeenCalledTimes(1)
    await act(async () => gate.resolve({ kind: 'ok' }))
  })
})
