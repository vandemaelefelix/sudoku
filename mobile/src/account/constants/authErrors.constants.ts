/** The field that a sign-in error belongs to. form: the error shows above the button. */
export type AuthField = 'email' | 'password' | 'code' | 'form'

export const GENERIC_AUTH_ERROR = 'This did not work. Try again.'
export const OFFLINE_AUTH_ERROR = 'No connection. Try again when you are online.'
export const GOOGLE_ACCOUNT_ERROR = 'This account uses Google. Sign in with Google.'
export const UNSUPPORTED_SIGN_IN_ERROR = 'This sign-in needs a step the app does not support yet.'
export const NEW_PASSWORD_ERROR = 'This account needs a new password. The app cannot set one yet.'
export const UNSUPPORTED_SIGN_UP_ERROR = 'This sign-up needs a step the app does not support yet.'
export const MISSING_REQUIREMENTS_ERROR = 'This sign-up needs more details than the app asks for yet.'
export const ABANDONED_SIGN_UP_ERROR = 'This sign-up expired. Go back and start again.'
export const GOOGLE_AUTH_ERROR = 'Google sign-in did not work. Try again.'

/** The short message for each Clerk error code. A code that is not here gets GENERIC_AUTH_ERROR. */
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  form_identifier_not_found: 'No account uses this email.',
  form_identifier_exists: 'An account uses this email. Sign in instead.',
  form_param_format_invalid: 'Enter a valid email address.',
  form_param_nil: 'Fill in this field.',
  form_param_missing: 'Fill in this field.',
  form_password_incorrect: 'The password is not correct.',
  form_password_pwned: 'This password is in a known data leak. Choose another one.',
  form_password_length_too_short: 'The password needs at least 8 characters.',
  form_password_not_strong_enough: 'Choose a stronger password.',
  form_code_incorrect: 'The code is not correct.',
  verification_expired: 'The code expired. Send a new one.',
  verification_failed: 'Too many wrong codes. Send a new one.',
  too_many_requests: 'Too many tries. Wait a moment, then try again.',
  user_locked: 'Too many tries. Wait a moment, then try again.',
  strategy_for_user_invalid: 'This account uses Google. Continue with Google.',
}

/** The Clerk `meta.paramName` of each field. A name that is not here shows above the button. */
export const AUTH_FIELD_OF_PARAM: Readonly<Record<string, AuthField>> = {
  identifier: 'email',
  email_address: 'email',
  password: 'password',
  code: 'code',
}

export const OFFLINE_ERROR_CODE = 'clerk_offline'
