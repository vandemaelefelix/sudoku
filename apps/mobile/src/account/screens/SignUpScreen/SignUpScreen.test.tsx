import { useSignUp } from '@clerk/expo'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AccountContext, UNCONFIGURED_ACCOUNT } from '@/account/hooks/useAccount'
import { SignUpScreen } from './SignUpScreen'

type Result = { error: unknown }
const ok = async (): Promise<Result> => ({ error: null })

function fakeSignUp() {
  const signUp = {
    status: 'missing_requirements',
    password: jest.fn(ok),
    verifications: {
      sendEmailCode: jest.fn(ok),
      verifyEmailCode: jest.fn(async (): Promise<Result> => {
        signUp.status = 'complete'
        return { error: null }
      }),
    },
    finalize: jest.fn(ok),
  }
  jest
    .mocked(useSignUp)
    .mockReturnValue({ signUp, fetchStatus: 'idle', errors: {} } as unknown as ReturnType<typeof useSignUp>)
  return signUp
}

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
