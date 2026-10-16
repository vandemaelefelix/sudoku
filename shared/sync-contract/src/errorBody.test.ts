import { describe, expect, it } from 'vitest'
import { errorBodySchema } from './errorBody'

function accepts(value: unknown): boolean {
  return errorBodySchema.safeParse(value).success
}

describe('errorBodySchema', () => {
  it.each(['invalid_request', 'invalid_cursor', 'account_deleted'])('accepts the code %s', (code) => {
    expect(accepts({ code, message: 'The request is not valid.' })).toBe(true)
  })

  it.each(['teapot', 'daily_limit', 'internal_error'])('refuses the code %s', (code) => {
    expect(accepts({ code, message: 'No.' })).toBe(false)
  })

  it('refuses an empty message', () => {
    expect(accepts({ code: 'invalid_request', message: '' })).toBe(false)
  })

  it('refuses a message of 501 characters', () => {
    expect(accepts({ code: 'invalid_request', message: 'a'.repeat(501) })).toBe(false)
  })

  it('refuses a body without a message', () => {
    expect(accepts({ code: 'invalid_request' })).toBe(false)
  })
})
