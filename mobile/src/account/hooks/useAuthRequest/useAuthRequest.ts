import { useCallback, useRef, useState } from 'react'
import { authErrorsOf, type AuthErrors } from '@/account/utils/authErrors.utils'
import type { MessageId } from '@/i18n/messages'

/** The Core 3 Clerk methods give their error in the result instead of a throw. */
export type ClerkResult = { error: unknown }

export type AuthRequest = {
  busy: boolean
  errors: AuthErrors
  /**
   * Runs one step of a flow. It clears the old errors, and it turns a throw or a Clerk error into messages.
   * `failWith` shows a message of our own above the button, for a status that Clerk reports without an error. It takes a message id.
   */
  run(step: (fail: (error: unknown) => void, failWith: (message: MessageId) => void) => Promise<void>): Promise<void>
}

export function useAuthRequest(): AuthRequest {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<AuthErrors>({})
  // A second tap while a request runs does nothing. State would let a fast double tap through.
  const running = useRef(false)
  const run = useCallback<AuthRequest['run']>(async (step) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setErrors({})
    try {
      await step(
        (error) => setErrors(authErrorsOf(error)),
        (message) => setErrors({ form: message }),
      )
    } catch (error) {
      setErrors(authErrorsOf(error))
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])
  return { busy, errors, run }
}
