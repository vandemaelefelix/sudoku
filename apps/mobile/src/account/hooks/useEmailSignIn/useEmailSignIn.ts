import { useSignIn } from '@clerk/expo'
import { useState } from 'react'
import { useAuthRequest } from '@/account/hooks/useAuthRequest'
import type { AuthErrors } from '@/account/utils/authErrors.utils'

/**
 * credentials: the email and the password. code: Clerk does not trust this device yet and sent an email code.
 * unsupported: the account uses two-step verification, which the app does not offer.
 */
export type SignInStep = 'credentials' | 'code' | 'unsupported'

export type EmailSignIn = {
  step: SignInStep
  busy: boolean
  errors: AuthErrors
  submit(email: string, password: string): Promise<void>
  verifyCode(code: string): Promise<void>
  resendCode(): Promise<void>
  /** Back to the email and the password. */
  restart(): void
}

/** The email sign-in of the Clerk Core 3 API: password, an email code on a new device, then finalize. */
export function useEmailSignIn(onDone: () => void): EmailSignIn {
  const { signIn } = useSignIn()
  const { busy, errors, run } = useAuthRequest()
  const [step, setStep] = useState<SignInStep>('credentials')
  return {
    step,
    busy,
    errors,
    submit: (email, password) =>
      run(async (fail) => {
        const result = await signIn.password({ identifier: email, password })
        if (result.error) return fail(result.error)
        if (signIn.status === 'needs_second_factor') return setStep('unsupported')
        if (signIn.status === 'needs_client_trust') {
          const sent = await signIn.mfa.sendEmailCode()
          if (sent.error) return fail(sent.error)
          return setStep('code')
        }
        if (signIn.status !== 'complete') return fail(undefined)
        const finished = await signIn.finalize()
        if (finished.error) return fail(finished.error)
        onDone()
      }),
    verifyCode: (code) =>
      run(async (fail) => {
        const verified = await signIn.mfa.verifyEmailCode({ code })
        if (verified.error) return fail(verified.error)
        if (signIn.status !== 'complete') return fail(undefined)
        const finished = await signIn.finalize()
        if (finished.error) return fail(finished.error)
        onDone()
      }),
    resendCode: () =>
      run(async (fail) => {
        const sent = await signIn.mfa.sendEmailCode()
        if (sent.error) fail(sent.error)
      }),
    restart: () => setStep('credentials'),
  }
}
