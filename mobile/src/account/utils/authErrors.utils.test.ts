import { authErrorsOf } from './authErrors.utils'

function apiError(...errors: Array<{ code: string; paramName?: string }>) {
  return {
    code: 'api_response_error',
    message: 'raw',
    errors: errors.map(({ code, paramName }) => ({
      code,
      message: `raw ${code}`,
      meta: paramName === undefined ? {} : { paramName },
    })),
  }
}

it('puts a known code under its field', () => {
  expect(authErrorsOf(apiError({ code: 'form_password_incorrect', paramName: 'password' }))).toEqual({
    password: 'The password is not correct.',
  })
  expect(authErrorsOf(apiError({ code: 'form_identifier_not_found', paramName: 'identifier' }))).toEqual({
    email: 'No account uses this email.',
  })
  expect(authErrorsOf(apiError({ code: 'form_code_incorrect', paramName: 'code' }))).toEqual({
    code: 'The code is not correct.',
  })
  expect(authErrorsOf(apiError({ code: 'form_identifier_exists', paramName: 'email_address' }))).toEqual({
    email: 'An account uses this email. Sign in instead.',
  })
})

it('keeps one message per field and puts an error without a field above the button', () => {
  expect(
    authErrorsOf(
      apiError(
        { code: 'form_password_length_too_short', paramName: 'password' },
        { code: 'form_password_pwned', paramName: 'password' },
        { code: 'too_many_requests' },
      ),
    ),
  ).toEqual({
    password: 'The password needs at least 8 characters.',
    form: 'Too many tries. Wait a moment, then try again.',
  })
})

it('gives the generic message for an unknown code, never the raw Clerk text', () => {
  expect(authErrorsOf(apiError({ code: 'something_new', paramName: 'password' }))).toEqual({
    password: 'This did not work. Try again.',
  })
  expect(authErrorsOf(new Error('Trace 123: boom'))).toEqual({ form: 'This did not work. Try again.' })
  expect(authErrorsOf(undefined)).toEqual({ form: 'This did not work. Try again.' })
})

it('says when the phone is offline', () => {
  expect(authErrorsOf({ code: 'clerk_offline', message: 'raw' })).toEqual({
    form: 'No connection. Try again when you are online.',
  })
  expect(authErrorsOf(new TypeError('Network request failed'))).toEqual({
    form: 'No connection. Try again when you are online.',
  })
})
