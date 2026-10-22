import { useSignIn } from '@clerk/expo'
import { act, renderHook } from '@testing-library/react-native'
import { useEmailSignIn } from './useEmailSignIn'

type Result = { error: unknown }
const ok = async (): Promise<Result> => ({ error: null })

function fakeSignIn(statusAfterPassword: string, supportedFirstFactors: { strategy: string }[] = []) {
  const signIn = {
    status: 'needs_identifier',
    supportedFirstFactors,
    password: jest.fn(async (): Promise<Result> => {
      signIn.status = statusAfterPassword
      return { error: null }
    }),
    mfa: {
      sendEmailCode: jest.fn(ok),
      verifyEmailCode: jest.fn(async () => {
        signIn.status = 'complete'
        return { error: null }
      }),
    },
    finalize: jest.fn(ok),
  }
  jest
    .mocked(useSignIn)
    .mockReturnValue({ signIn, fetchStatus: 'idle', errors: {} } as unknown as ReturnType<typeof useSignIn>)
  return signIn
}

it('finishes at once when Clerk says complete', async () => {
  const signIn = fakeSignIn('complete')
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignIn(onDone))
  await act(() => result.current.submit('alice@example.com', 'secret'))
  expect(signIn.password).toHaveBeenCalledWith({ identifier: 'alice@example.com', password: 'secret' })
  expect(signIn.finalize).toHaveBeenCalled()
  expect(onDone).toHaveBeenCalled()
})

it('asks for an email code on a new device, then finishes', async () => {
  const signIn = fakeSignIn('needs_client_trust')
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignIn(onDone))
  await act(() => result.current.submit('alice@example.com', 'secret'))
  expect(signIn.mfa.sendEmailCode).toHaveBeenCalled()
  expect(result.current.step).toBe('code')
  expect(onDone).not.toHaveBeenCalled()
  await act(() => result.current.verifyCode('123456'))
  expect(signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: '123456' })
  expect(onDone).toHaveBeenCalled()
})

it('says that two-step verification is not supported', async () => {
  const signIn = fakeSignIn('needs_second_factor')
  const { result } = renderHook(() => useEmailSignIn(jest.fn()))
  await act(() => result.current.submit('alice@example.com', 'secret'))
  expect(result.current.step).toBe('unsupported')
  expect(signIn.finalize).not.toHaveBeenCalled()
})

it('shows a wrong password under the password field', async () => {
  const signIn = fakeSignIn('complete')
  signIn.password.mockImplementation(async () => ({
    error: {
      code: 'api_response_error',
      errors: [{ code: 'form_password_incorrect', message: 'raw', meta: { paramName: 'password' } }],
    },
  }))
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignIn(onDone))
  await act(() => result.current.submit('alice@example.com', 'wrong'))
  expect(result.current.errors).toEqual({ password: 'account.error.passwordIncorrect' })
  expect(onDone).not.toHaveBeenCalled()
})

async function submitWith(status: string, factors: { strategy: string }[] = []) {
  const signIn = fakeSignIn(status, factors)
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignIn(onDone))
  await act(() => result.current.submit('alice@example.com', 'secret'))
  expect(signIn.finalize).not.toHaveBeenCalled()
  expect(onDone).not.toHaveBeenCalled()
  return result.current.errors
}

describe('a status that the app cannot finish', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => warn.mockRestore())

  it('sends a Google-only account to the Google button', async () => {
    const errors = await submitWith('needs_first_factor', [{ strategy: 'oauth_google' }])
    expect(errors).toEqual({ form: 'account.error.googleAccount' })
    expect(warn).toHaveBeenCalledWith('[account] Clerk sign-in status needs_first_factor')
  })

  it('says that another first step is not supported', async () => {
    const errors = await submitWith('needs_first_factor', [{ strategy: 'email_code' }])
    expect(errors).toEqual({ form: 'account.error.unsupportedSignIn' })
  })

  it('says that a forced new password is not supported', async () => {
    const errors = await submitWith('needs_new_password')
    expect(errors).toEqual({ form: 'account.error.newPassword' })
    expect(warn).toHaveBeenCalledWith('[account] Clerk sign-in status needs_new_password')
  })

  it('gives the generic message for an unknown status and warns with the status', async () => {
    const errors = await submitWith('needs_something_new')
    expect(errors).toEqual({ form: 'account.error.unsupportedSignIn' })
    expect(warn).toHaveBeenCalledWith('[account] Clerk sign-in status needs_something_new')
  })
})
