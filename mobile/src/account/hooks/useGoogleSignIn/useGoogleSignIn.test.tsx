import { useSignInWithGoogle } from '@clerk/expo/google'
import { act, renderHook } from '@testing-library/react-native'
import { useGoogleSignIn } from './useGoogleSignIn'

function googleAnswers(flow: () => Promise<unknown>) {
  const start = jest.fn(flow)
  jest
    .mocked(useSignInWithGoogle)
    .mockReturnValue({ startGoogleAuthenticationFlow: start } as unknown as ReturnType<typeof useSignInWithGoogle>)
  return start
}

it('activates the new session and finishes', async () => {
  const setActive = jest.fn(async () => undefined)
  googleAnswers(async () => ({ createdSessionId: 'sess_1', setActive }))
  const onDone = jest.fn()
  const { result } = renderHook(() => useGoogleSignIn(onDone))
  await act(() => result.current.signIn())
  expect(setActive).toHaveBeenCalledWith({ session: 'sess_1' })
  expect(onDone).toHaveBeenCalled()
  expect(result.current.error).toBeUndefined()
})

it('stays silent when the player closes the Google sheet', async () => {
  googleAnswers(async () => ({ createdSessionId: null, setActive: jest.fn() }))
  const onDone = jest.fn()
  const { result } = renderHook(() => useGoogleSignIn(onDone))
  await act(() => result.current.signIn())
  expect(onDone).not.toHaveBeenCalled()
  expect(result.current.error).toBeUndefined()
})

it('gives a short message when Google sign-in fails', async () => {
  googleAnswers(async () => {
    throw new Error('Trace 42: DEVELOPER_ERROR')
  })
  const { result } = renderHook(() => useGoogleSignIn(jest.fn()))
  await act(() => result.current.signIn())
  expect(result.current.error).toBe('Google sign-in did not work. Try again.')
})

it('says when the phone is offline', async () => {
  googleAnswers(async () => {
    throw new TypeError('Network request failed')
  })
  const { result } = renderHook(() => useGoogleSignIn(jest.fn()))
  await act(() => result.current.signIn())
  expect(result.current.error).toBe('No connection. Try again when you are online.')
})
