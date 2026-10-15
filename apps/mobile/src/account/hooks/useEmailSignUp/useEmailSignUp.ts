import { useSignUp } from '@clerk/expo'
import { useState } from 'react'
import { useAuthRequest } from '@/account/hooks/useAuthRequest'
import { signUpStatusMessage, type AuthErrors } from '@/account/utils/authErrors.utils'
import { devWarn } from '@/utils/log.utils'

/** details: the email and the password. code: the 6-digit code that Clerk sent to the email. */
export type SignUpStep = 'details' | 'code'

export type EmailSignUp = {
  step: SignUpStep
  busy: boolean
  errors: AuthErrors
  submit(email: string, password: string): Promise<void>
  verifyCode(code: string): Promise<void>
  resendCode(): Promise<void>
  /** Back from the code step to the details, for a typo in the email. */
  editDetails(): void
}

/** The email sign-up of the Clerk Core 3 API: password, then the email code, then finalize. */
export function useEmailSignUp(onDone: () => void): EmailSignUp {
  const { signUp } = useSignUp()
  const { busy, errors, run } = useAuthRequest()
  const [step, setStep] = useState<SignUpStep>('details')
  return {
    step,
    busy,
    errors,
    submit: (email, password) =>
      run(async (fail) => {
        const created = await signUp.password({ emailAddress: email, password })
        if (created.error) return fail(created.error)
        const sent = await signUp.verifications.sendEmailCode()
        if (sent.error) return fail(sent.error)
        setStep('code')
      }),
    verifyCode: (code) =>
      run(async (fail, failWith) => {
        const verified = await signUp.verifications.verifyEmailCode({ code })
        if (verified.error) return fail(verified.error)
        if (signUp.status !== 'complete') {
          devWarn('account', `Clerk sign-up status ${signUp.status}`)
          return failWith(signUpStatusMessage(signUp.status))
        }
        const finished = await signUp.finalize()
        if (finished.error) return fail(finished.error)
        onDone()
      }),
    resendCode: () =>
      run(async (fail) => {
        const sent = await signUp.verifications.sendEmailCode()
        if (sent.error) fail(sent.error)
      }),
    editDetails: () => setStep('details'),
  }
}
