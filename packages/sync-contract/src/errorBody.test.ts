import { describe, expect, it } from 'vitest'
import { errorBodySchema } from './errorBody'

function accepts(value: unknown): boolean {
  return errorBodySchema.safeParse(value).success
}

describe('errorBodySchema', () => {
  it.each(['invalid_request', 'daily_limit', 'internal_error'])('accepts the code %s', (code) => {
    expect(accepts({ code, message: 'The request is not valid.' })).toBe(true)
  })

  it('refuses an unknown code', () => {
    expect(accepts({ code: 'teapot', message: 'No.' })).toBe(false)
  })

  it('refuses an empty message', () => {
    expect(accepts({ code: 'internal_error', message: '' })).toBe(false)
  })

  it('refuses a message of 501 characters', () => {
    expect(accepts({ code: 'internal_error', message: 'a'.repeat(501) })).toBe(false)
  })

  it('refuses a body without a message', () => {
    expect(accepts({ code: 'internal_error' })).toBe(false)
  })
})
