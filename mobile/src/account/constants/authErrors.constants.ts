import type { MessageId } from '@/i18n/messages'

/** The field that a sign-in error belongs to. form: the error shows above the button. */
export type AuthField = 'email' | 'password' | 'code' | 'form'

export const GENERIC_AUTH_ERROR: MessageId = 'account.error.generic'
export const OFFLINE_AUTH_ERROR: MessageId = 'account.error.offline'
export const GOOGLE_ACCOUNT_ERROR: MessageId = 'account.error.googleAccount'
export const UNSUPPORTED_SIGN_IN_ERROR: MessageId = 'account.error.unsupportedSignIn'
export const NEW_PASSWORD_ERROR: MessageId = 'account.error.newPassword'
export const UNSUPPORTED_SIGN_UP_ERROR: MessageId = 'account.error.unsupportedSignUp'
export const MISSING_REQUIREMENTS_ERROR: MessageId = 'account.error.missingRequirements'
export const ABANDONED_SIGN_UP_ERROR: MessageId = 'account.error.abandoned'
export const GOOGLE_AUTH_ERROR: MessageId = 'account.error.googleAuth'

/** The message id of each Clerk error code. A code that is not here gets GENERIC_AUTH_ERROR. */
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, MessageId>> = {
  form_identifier_not_found: 'account.error.identifierNotFound',
  form_identifier_exists: 'account.error.identifierExists',
  form_param_format_invalid: 'account.error.emailInvalid',
  form_param_nil: 'account.error.fieldMissing',
  form_param_missing: 'account.error.fieldMissing',
  form_password_incorrect: 'account.error.passwordIncorrect',
  form_password_pwned: 'account.error.passwordLeaked',
  form_password_length_too_short: 'account.error.passwordShort',
  form_password_not_strong_enough: 'account.error.passwordWeak',
  form_code_incorrect: 'account.error.codeIncorrect',
  verification_expired: 'account.error.codeExpired',
  verification_failed: 'account.error.codeFailed',
  too_many_requests: 'account.error.tooManyTries',
  user_locked: 'account.error.tooManyTries',
  strategy_for_user_invalid: 'account.error.continueGoogle',
}

/** The Clerk `meta.paramName` of each field. A name that is not here shows above the button. */
export const AUTH_FIELD_OF_PARAM: Readonly<Record<string, AuthField>> = {
  identifier: 'email',
  email_address: 'email',
  password: 'password',
  code: 'code',
}

export const OFFLINE_ERROR_CODE = 'clerk_offline'
