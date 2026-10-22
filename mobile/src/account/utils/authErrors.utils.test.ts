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
    password: 'account.error.passwordIncorrect',
  })
  expect(authErrorsOf(apiError({ code: 'form_identifier_not_found', paramName: 'identifier' }))).toEqual({
    email: 'account.error.identifierNotFound',
  })
  expect(authErrorsOf(apiError({ code: 'form_code_incorrect', paramName: 'code' }))).toEqual({
    code: 'account.error.codeIncorrect',
  })
  expect(authErrorsOf(apiError({ code: 'form_identifier_exists', paramName: 'email_address' }))).toEqual({
    email: 'account.error.identifierExists',
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
    password: 'account.error.passwordShort',
    form: 'account.error.tooManyTries',
  })
})

it('gives the generic message for an unknown code, never the raw Clerk text', () => {
  expect(authErrorsOf(apiError({ code: 'something_new', paramName: 'password' }))).toEqual({
    password: 'account.error.generic',
  })
  expect(authErrorsOf(new Error('Trace 123: boom'))).toEqual({ form: 'account.error.generic' })
  expect(authErrorsOf(undefined)).toEqual({ form: 'account.error.generic' })
})

it('says when the phone is offline', () => {
  expect(authErrorsOf({ code: 'clerk_offline', message: 'raw' })).toEqual({
    form: 'account.error.offline',
  })
  expect(authErrorsOf(new TypeError('Network request failed'))).toEqual({
    form: 'account.error.offline',
  })
})
