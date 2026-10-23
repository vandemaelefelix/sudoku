import { useAuth, useSignIn, useSignUp } from '@clerk/expo'
import { useSignInWithGoogle } from '@clerk/expo/google'
import type { OwnerCache } from '@/account/utils/ownerCache.utils'

/** The owner cache in memory. `current` and `isPending` show what the Keychain would hold. */
export function memoryOwnerCache(owner: string | null = null) {
  let cached = owner
  let pending = false
  const cache: OwnerCache = {
    read: async () => cached,
    write: async (next) => {
      cached = next
    },
    pendingSignOut: async () => pending,
    setPendingSignOut: async (next) => {
      pending = next
    },
  }
  return Object.assign(cache, { current: () => cached, isPending: () => pending })
}

type Result = { error: unknown }
const ok = async (): Promise<Result> => ({ error: null })

/** The Clerk sign-in resource. `useSignIn` returns it. The password step moves it to `statusAfterPassword`. */
export function fakeSignIn(statusAfterPassword: string, supportedFirstFactors: { strategy: string }[] = []) {
  const signIn = {
    status: 'needs_identifier',
    supportedFirstFactors,
    password: jest.fn(async (): Promise<Result> => {
      signIn.status = statusAfterPassword
      return { error: null }
    }),
    mfa: {
      sendEmailCode: jest.fn(ok),
      verifyEmailCode: jest.fn(async (): Promise<Result> => {
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

/** The Clerk sign-up resource. `useSignUp` returns it. A right email code moves it to `complete`. */
export function fakeSignUp(overrides: Record<string, unknown> = {}) {
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

/** Makes the Google sheet run `flow`. Returns the start function, so a test can check the call. */
export function googleAnswers(flow: () => Promise<unknown>) {
  const start = jest.fn(flow)
  jest
    .mocked(useSignInWithGoogle)
    .mockReturnValue({ startGoogleAuthenticationFlow: start } as unknown as ReturnType<typeof useSignInWithGoogle>)
  return start
}

/** Makes `useAuth` report a signed-in player. Returns `signOut`. */
export function clerkSignedIn(
  userId: string,
  {
    getToken = jest.fn(),
    signOut = jest.fn(async () => undefined),
  }: { getToken?: jest.Mock; signOut?: jest.Mock } = {},
) {
  jest
    .mocked(useAuth)
    .mockReturnValue({ isLoaded: true, isSignedIn: true, userId, getToken, signOut } as unknown as ReturnType<
      typeof useAuth
    >)
  return signOut
}

/** Makes `useAuth` report a loaded session with no player. */
export function clerkSignedOut() {
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    getToken: jest.fn(),
    signOut: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>)
}
