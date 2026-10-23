import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { fakeSignIn, googleAnswers as googleGives } from '@/account/account.testkit'
import { AccountContext, UNCONFIGURED_ACCOUNT } from '@/account/hooks/useAccount'
import { SignInScreen } from './SignInScreen'

function SignedOut({ children }: { children: ReactNode }) {
  return <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, status: 'signedOut' }}>{children}</AccountContext>
}

function renderScreen(props: Partial<Parameters<typeof SignInScreen>[0]> = {}) {
  return render(<SignInScreen onDone={jest.fn()} onBack={jest.fn()} onSignUp={jest.fn()} {...props} />, {
    wrapper: SignedOut,
  })
}

async function signInWith(email: string, password: string) {
  fireEvent.changeText(screen.getByLabelText('Email'), email)
  fireEvent.changeText(screen.getByLabelText('Password'), password)
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign in' })))
}

it('shows the title, the labelled fields, the button and the way to sign up', () => {
  fakeSignIn('complete')
  const onSignUp = jest.fn()
  renderScreen({ onSignUp })
  expect(screen.getByRole('header', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByLabelText('Password').props.textContentType).toBe('password')
  fireEvent.press(screen.getByRole('button', { name: 'Create an account' }))
  expect(onSignUp).toHaveBeenCalled()
})

it('signs in and finishes', async () => {
  fakeSignIn('complete')
  const onDone = jest.fn()
  renderScreen({ onDone })
  await signInWith('alice@example.com', 'secret')
  expect(onDone).toHaveBeenCalled()
})

it('asks for the email code on a new device', async () => {
  fakeSignIn('needs_client_trust')
  const onDone = jest.fn()
  renderScreen({ onDone })
  await signInWith('alice@example.com', 'secret')
  expect(screen.getByText('We sent a code to alice@example.com.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Code'), '123456')
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Verify' })))
  expect(onDone).toHaveBeenCalled()
})

it('says that two-step verification is not supported', async () => {
  fakeSignIn('needs_second_factor')
  renderScreen()
  await signInWith('alice@example.com', 'secret')
  expect(screen.getByText('This account uses two-step verification. The app does not support it yet.')).toBeTruthy()
})

it('shows a wrong password under the field', async () => {
  const signIn = fakeSignIn('complete')
  signIn.password.mockResolvedValue({
    error: { errors: [{ code: 'form_password_incorrect', message: 'raw', meta: { paramName: 'password' } }] },
  })
  renderScreen()
  await signInWith('alice@example.com', 'wrong')
  expect(screen.getByText('The password is not correct.')).toBeTruthy()
})

it('disables the button while the request runs', async () => {
  const signIn = fakeSignIn('complete')
  let release: (() => void) | undefined
  signIn.password.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = () => resolve({ error: null })
      }),
  )
  renderScreen()
  fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com')
  fireEvent.changeText(screen.getByLabelText('Password'), 'secret')
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
  expect(signIn.password).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Sign in' }).props.accessibilityState).toMatchObject({ disabled: true })
  await act(async () => release?.())
})

describe('Google', () => {
  it('finishes after the Google sheet gives a session', async () => {
    fakeSignIn('complete')
    const setActive = jest.fn(async () => undefined)
    googleGives(async () => ({ createdSessionId: 'sess_1', setActive }))
    const onDone = jest.fn()
    renderScreen({ onDone })
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' })))
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_1' })
    expect(onDone).toHaveBeenCalled()
  })

  it('shows a short message when Google fails', async () => {
    fakeSignIn('complete')
    googleGives(async () => {
      throw new Error('boom')
    })
    renderScreen()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' })))
    expect(screen.getByText('Google sign-in did not work. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })
})
