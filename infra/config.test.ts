import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CLERK_ISSUER, hasClerk } from './config.ts'

describe('CLERK_ISSUER', () => {
  it('gives felix and dev the same development instance', () => {
    assert.ok(CLERK_ISSUER.felix)
    assert.equal(CLERK_ISSUER.dev, CLERK_ISSUER.felix)
  })

  it('holds only the origin of a development instance, without a path or a slash at the end', () => {
    assert.match(CLERK_ISSUER.felix ?? '', /^https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev$/)
  })

  it('has no issuer for production until it has its own instance', () => {
    assert.equal(CLERK_ISSUER.production, null)
  })
})

describe('hasClerk', () => {
  it('is true for the stages that share the development instance', () => {
    assert.equal(hasClerk('felix'), true)
    assert.equal(hasClerk('dev'), true)
  })

  it('is false for production until it has its own instance', () => {
    assert.equal(hasClerk('production'), false)
  })
})
