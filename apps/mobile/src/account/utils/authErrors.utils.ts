import {
  AUTH_ERROR_MESSAGES,
  AUTH_FIELD_OF_PARAM,
  GENERIC_AUTH_ERROR,
  OFFLINE_AUTH_ERROR,
  OFFLINE_ERROR_CODE,
  type AuthField,
} from '@/account/constants/authErrors.constants'

export type AuthErrors = Partial<Record<AuthField, string>>

type ApiErrorLike = { code?: unknown; meta?: { paramName?: unknown } }

function isOffline(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ((error as { code?: unknown }).code === OFFLINE_ERROR_CODE) return true
  // React Native fetch rejects with this TypeError when the phone has no network.
  return error instanceof TypeError && /network request failed/i.test(error.message)
}

/**
 * The short messages for a Clerk error, one per field. The raw Clerk text can hold a trace ID, so it never shows.
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
