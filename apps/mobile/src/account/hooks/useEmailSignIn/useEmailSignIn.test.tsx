import { useSignIn } from '@clerk/expo'
import { act, renderHook } from '@testing-library/react-native'
import { useEmailSignIn } from './useEmailSignIn'

type Result = { error: unknown }
const ok = async (): Promise<Result> => ({ error: null })

function fakeSignIn(statusAfterPassword: string) {
  const signIn = {
    status: 'needs_identifier',
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
  expect(result.current.errors).toEqual({ password: 'The password is not correct.' })
  expect(onDone).not.toHaveBeenCalled()
})
