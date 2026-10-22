import {
  ABANDONED_SIGN_UP_ERROR,
  AUTH_ERROR_MESSAGES,
  AUTH_FIELD_OF_PARAM,
  GENERIC_AUTH_ERROR,
  GOOGLE_ACCOUNT_ERROR,
  MISSING_REQUIREMENTS_ERROR,
  NEW_PASSWORD_ERROR,
  OFFLINE_AUTH_ERROR,
  OFFLINE_ERROR_CODE,
  UNSUPPORTED_SIGN_IN_ERROR,
  UNSUPPORTED_SIGN_UP_ERROR,
  type AuthField,
} from '@/account/constants/authErrors.constants'
import type { MessageId } from '@/i18n/messages'

export type AuthErrors = Partial<Record<AuthField, MessageId>>

type ApiErrorLike = { code?: unknown; meta?: { paramName?: unknown } }

export function isOffline(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ((error as { code?: unknown }).code === OFFLINE_ERROR_CODE) return true
  // React Native fetch rejects with this TypeError when the phone has no network.
  return error instanceof TypeError && /network request failed/i.test(error.message)
}

/**
 * The message ids for a Clerk error, one per field. The raw Clerk text can hold a trace ID, so it never shows.
 * The first error of a field wins.
 */
export function authErrorsOf(error: unknown): AuthErrors {
  if (isOffline(error)) return { form: OFFLINE_AUTH_ERROR }
  const list = (error as { errors?: unknown } | null | undefined)?.errors
  if (!Array.isArray(list) || list.length === 0) return { form: GENERIC_AUTH_ERROR }
  const result: AuthErrors = {}
  for (const item of list as ApiErrorLike[]) {
    const param = item.meta?.paramName
    const field = (typeof param === 'string' && AUTH_FIELD_OF_PARAM[param]) || 'form'
    const code = typeof item.code === 'string' ? item.code : ''
    result[field] ??= AUTH_ERROR_MESSAGES[code] ?? GENERIC_AUTH_ERROR
  }
  return result
}

/** The message for a sign-in that Clerk leaves in a status the app cannot finish. */
export function signInStatusMessage(
  status: string,
  firstFactors: readonly { strategy: string }[] | undefined,
): MessageId {
  if (status === 'needs_new_password') return NEW_PASSWORD_ERROR
  const strategies = (firstFactors ?? []).map((factor) => factor.strategy)
  const onlyGoogle = strategies.length > 0 && strategies.every((strategy) => strategy === 'oauth_google')
  if (status === 'needs_first_factor' && onlyGoogle) return GOOGLE_ACCOUNT_ERROR
  return UNSUPPORTED_SIGN_IN_ERROR
}

/** The message for a sign-up that Clerk leaves in a status the app cannot finish. */
export function signUpStatusMessage(status: string): MessageId {
  if (status === 'missing_requirements') return MISSING_REQUIREMENTS_ERROR
  if (status === 'abandoned') return ABANDONED_SIGN_UP_ERROR
  return UNSUPPORTED_SIGN_UP_ERROR
}
