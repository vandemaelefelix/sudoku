import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { fakeSignUp, googleAnswers as googleGives } from '@/account/account.testkit'
import { AccountContext, UNCONFIGURED_ACCOUNT } from '@/account/hooks/useAccount'
import { SignUpScreen } from './SignUpScreen'

function SignedOut({ children }: { children: ReactNode }) {
  return <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, status: 'signedOut' }}>{children}</AccountContext>
}

function renderScreen(props: Partial<Parameters<typeof SignUpScreen>[0]> = {}) {
  return render(<SignUpScreen onDone={jest.fn()} onBack={jest.fn()} onSignIn={jest.fn()} {...props} />, {
    wrapper: SignedOut,
  })
}

it('shows the title, the labelled fields and the button', () => {
  fakeSignUp()
  renderScreen()
  expect(screen.getByRole('header', { name: 'Create an account' })).toBeTruthy()
  expect(screen.getByLabelText('Email')).toBeTruthy()
  expect(screen.getByLabelText('Password').props.textContentType).toBe('newPassword')
  expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy()
})

it('signs up, shows the code step with the email, and finishes', async () => {
  const signUp = fakeSignUp()
  const onDone = jest.fn()
  renderScreen({ onDone })
  fireEvent.changeText(screen.getByLabelText('Email'), ' alice@example.com ')
  fireEvent.changeText(screen.getByLabelText('Password'), 'a long password')
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Create account' })))
  expect(signUp.password).toHaveBeenCalledWith({ emailAddress: 'alice@example.com', password: 'a long password' })
  expect(screen.getByText('We sent a code to alice@example.com.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Code'), '123456')
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Verify' })))
  expect(onDone).toHaveBeenCalled()
})

it('shows a field error under the field', async () => {
  const signUp = fakeSignUp()
  signUp.password.mockResolvedValue({
    error: { errors: [{ code: 'form_password_pwned', message: 'raw', meta: { paramName: 'password' } }] },
  })
  renderScreen()
  fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com')
  fireEvent.changeText(screen.getByLabelText('Password'), 'password1')
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Create account' })))
  expect(screen.getByText('This password is in a known data leak. Choose another one.')).toBeTruthy()
})

it('goes to sign-in and back', () => {
  fakeSignUp()
  const onSignIn = jest.fn()
  const onBack = jest.fn()
  renderScreen({ onSignIn, onBack })
  fireEvent.press(screen.getByRole('button', { name: 'I have an account' }))
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(onSignIn).toHaveBeenCalled()
  expect(onBack).toHaveBeenCalled()
})

it('shows only a short message when the build has no account', () => {
  render(<SignUpScreen onDone={jest.fn()} onBack={jest.fn()} onSignIn={jest.fn()} />)
  expect(screen.getByText('Accounts are not available in this version of the app.')).toBeTruthy()
  expect(screen.queryByLabelText('Email')).toBeNull()
})

describe('Google', () => {
  it('finishes after the Google sheet gives a session', async () => {
    fakeSignUp()
    const setActive = jest.fn(async () => undefined)
    googleGives(async () => ({ createdSessionId: 'sess_1', setActive }))
    const onDone = jest.fn()
    renderScreen({ onDone })
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' })))
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_1' })
    expect(onDone).toHaveBeenCalled()
  })

  it('shows a short message when Google fails', async () => {
    fakeSignUp()
    googleGives(async () => {
      throw new Error('boom')
    })
    renderScreen()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' })))
    expect(screen.getByText('Google sign-in did not work. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy()
  })
})
