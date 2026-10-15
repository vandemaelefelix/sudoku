import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Alert, type AlertButton } from 'react-native'
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
