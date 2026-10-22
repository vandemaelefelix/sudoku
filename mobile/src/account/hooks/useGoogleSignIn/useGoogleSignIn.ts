import { useSignInWithGoogle } from '@clerk/expo/google'
import { useRef, useState } from 'react'
import { GOOGLE_AUTH_ERROR, OFFLINE_AUTH_ERROR } from '@/account/constants/authErrors.constants'
import { isOffline } from '@/account/utils/authErrors.utils'
import type { MessageId } from '@/i18n/messages'
import { devWarn, errorMessage } from '@/utils/log.utils'

export type GoogleSignIn = {
  busy: boolean
  /** The message id of a failure. A cancel gives none. */
  error: MessageId | undefined
  signIn(): Promise<void>
}

/** The native Google sheet. Clerk signs in, or signs up a new player, with the Google ID token. */
export function useGoogleSignIn(onDone: () => void): GoogleSignIn {
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageId | undefined>(undefined)
  const running = useRef(false)
  const signIn = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(undefined)
    try {
      const { createdSessionId, setActive } = await startGoogleAuthenticationFlow()
      // Clerk gives no session when the player closes the sheet.
      if (createdSessionId === null || setActive === undefined) return
      await setActive({ session: createdSessionId })
      onDone()
    } catch (failure) {
      devWarn('account', `Google sign-in failed: ${errorMessage(failure)}`)
      setError(isOffline(failure) ? OFFLINE_AUTH_ERROR : GOOGLE_AUTH_ERROR)
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return { busy, error, signIn }
}
