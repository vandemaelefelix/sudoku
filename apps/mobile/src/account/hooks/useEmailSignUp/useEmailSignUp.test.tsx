import { useSignUp } from '@clerk/expo'
import { act, renderHook } from '@testing-library/react-native'
import { useEmailSignUp } from './useEmailSignUp'

type Result = { error: unknown }
const ok = async (): Promise<Result> => ({ error: null })

function fakeSignUp(overrides: Record<string, unknown> = {}) {
  const signUp = {
    status: 'missing_requirements',
    password: jest.fn(ok),
    verifications: { sendEmailCode: jest.fn(ok), verifyEmailCode: jest.fn(ok) },
    finalize: jest.fn(ok),
    ...overrides,
  }
  signUp.verifications.verifyEmailCode.mockImplementation(async () => {
    signUp.status = 'complete'
    return { error: null }
  })
  jest
    .mocked(useSignUp)
    .mockReturnValue({ signUp, fetchStatus: 'idle', errors: {} } as unknown as ReturnType<typeof useSignUp>)
  return signUp
}

function fieldError(code: string, paramName: string) {
  return { error: { code: 'api_response_error', errors: [{ code, message: 'raw', meta: { paramName } }] } }
}

it('creates the account, sends the code, checks it and finishes', async () => {
  const signUp = fakeSignUp()
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignUp(onDone))
  expect(result.current.step).toBe('details')
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  expect(signUp.password).toHaveBeenCalledWith({ emailAddress: 'alice@example.com', password: 'a long password' })
  expect(signUp.verifications.sendEmailCode).toHaveBeenCalled()
  expect(result.current.step).toBe('code')
  await act(() => result.current.verifyCode('123456'))
  expect(signUp.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: '123456' })
  expect(signUp.finalize).toHaveBeenCalled()
  expect(onDone).toHaveBeenCalled()
})

it('stops on a field error and sends no code', async () => {
  const signUp = fakeSignUp({ password: jest.fn(async () => fieldError('form_identifier_exists', 'email_address')) })
  const { result } = renderHook(() => useEmailSignUp(jest.fn()))
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  expect(signUp.verifications.sendEmailCode).not.toHaveBeenCalled()
  expect(result.current.step).toBe('details')
  expect(result.current.errors).toEqual({ email: 'An account uses this email. Sign in instead.' })
})

it('shows a wrong code under the code field and does not finish', async () => {
  const signUp = fakeSignUp()
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignUp(onDone))
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  signUp.verifications.verifyEmailCode.mockImplementation(async () => fieldError('form_code_incorrect', 'code'))
  await act(() => result.current.verifyCode('000000'))
  expect(result.current.errors).toEqual({ code: 'The code is not correct.' })
  expect(onDone).not.toHaveBeenCalled()
})

it('sends the code again', async () => {
  const signUp = fakeSignUp()
  const { result } = renderHook(() => useEmailSignUp(jest.fn()))
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  await act(() => result.current.resendCode())
  expect(signUp.verifications.sendEmailCode).toHaveBeenCalledTimes(2)
})

it('is busy while a request runs', async () => {
  let release: (() => void) | undefined
  fakeSignUp({
    password: jest.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ error: null })
        }),
    ),
  })
  const { result } = renderHook(() => useEmailSignUp(jest.fn()))
  let pending: Promise<void> = Promise.resolve()
  act(() => {
    pending = result.current.submit('alice@example.com', 'a long password')
  })
  expect(result.current.busy).toBe(true)
  await act(async () => {
    release?.()
    await pending
  })
  expect(result.current.busy).toBe(false)
})

it('shows the offline message when Clerk throws', async () => {
  fakeSignUp({
    password: jest.fn(async () => {
      throw new TypeError('Network request failed')
    }),
  })
  const { result } = renderHook(() => useEmailSignUp(jest.fn()))
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  expect(result.current.errors).toEqual({ form: 'No connection. Try again when you are online.' })
})
