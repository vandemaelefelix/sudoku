import { fakeSignUp } from '@/account/account.testkit'
import { act, renderHook } from '@testing-library/react-native'
import { useEmailSignUp } from './useEmailSignUp'

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
  expect(result.current.errors).toEqual({ email: 'account.error.identifierExists' })
})

it('shows a wrong code under the code field and does not finish', async () => {
  const signUp = fakeSignUp()
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignUp(onDone))
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  signUp.verifications.verifyEmailCode.mockImplementation(async () => fieldError('form_code_incorrect', 'code'))
  await act(() => result.current.verifyCode('000000'))
  expect(result.current.errors).toEqual({ code: 'account.error.codeIncorrect' })
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
  expect(result.current.errors).toEqual({ form: 'account.error.offline' })
})

async function verifyEndingIn(status: string) {
  const signUp = fakeSignUp()
  const onDone = jest.fn()
  const { result } = renderHook(() => useEmailSignUp(onDone))
  await act(() => result.current.submit('alice@example.com', 'a long password'))
  signUp.verifications.verifyEmailCode.mockImplementation(async () => {
    signUp.status = status
    return { error: null }
  })
  await act(() => result.current.verifyCode('123456'))
  expect(signUp.finalize).not.toHaveBeenCalled()
  expect(onDone).not.toHaveBeenCalled()
  return result.current.errors
}

describe('a status that the app cannot finish', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => warn.mockRestore())

  it('says that more details are needed when requirements are missing', async () => {
    const errors = await verifyEndingIn('missing_requirements')
    expect(errors).toEqual({ form: 'account.error.missingRequirements' })
    expect(warn).toHaveBeenCalledWith('[account] Clerk sign-up status missing_requirements')
  })

  it('asks to start again when the sign-up is abandoned', async () => {
    const errors = await verifyEndingIn('abandoned')
    expect(errors).toEqual({ form: 'account.error.abandoned' })
    expect(warn).toHaveBeenCalledWith('[account] Clerk sign-up status abandoned')
  })

  it('gives the unsupported message for an unknown status', async () => {
    const errors = await verifyEndingIn('needs_something_new')
    expect(errors).toEqual({ form: 'account.error.unsupportedSignUp' })
  })
})
