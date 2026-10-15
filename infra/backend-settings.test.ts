import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ACCESS_LOG_FORMAT,
  API_AUDIENCE,
  STAGE_THROTTLE,
  clerkIssuerOf,
  pointInTimeRecovery,
} from './backend-settings.ts'

describe('pointInTimeRecovery', () => {
  it('is on only in production', () => {
    assert.deepEqual(pointInTimeRecovery('production'), { enabled: true })
    assert.deepEqual(pointInTimeRecovery('felix'), { enabled: false })
    assert.deepEqual(pointInTimeRecovery('dev'), { enabled: false })
  })
})

describe('STAGE_THROTTLE', () => {
  it('allows 1 request per second with a burst of 10 (SUD-11, ADR-027 decision 9)', () => {
    assert.deepEqual(STAGE_THROTTLE, { throttlingRateLimit: 1, throttlingBurstLimit: 10 })
  })
})

describe('ACCESS_LOG_FORMAT', () => {
  const format = JSON.parse(ACCESS_LOG_FORMAT) as Record<string, string>

  it('is valid JSON with the request ID and the status', () => {
    assert.equal(format.requestId, '$context.requestId')
    assert.equal(format.status, '$context.status')
  })

  it('leaves out the IP and the user agent (F-16)', () => {
    assert.doesNotMatch(ACCESS_LOG_FORMAT, /sourceIp|userAgent/)
  })

  it('leaves out the token claims', () => {
    assert.doesNotMatch(ACCESS_LOG_FORMAT, /claims/)
  })
})

describe('clerkIssuerOf', () => {
  it('returns the issuer of the stage', () => {
    assert.equal(clerkIssuerOf('felix', { felix: 'https://a.clerk.accounts.dev' }), 'https://a.clerk.accounts.dev')
  })

  it('throws when the stage has no issuer, so a deploy cannot create an open API', () => {
    assert.throws(() => clerkIssuerOf('felix', { felix: null }), /felix has no Clerk issuer/)
    assert.throws(() => clerkIssuerOf('dev', {}), /dev has no Clerk issuer/)
  })
})

describe('API_AUDIENCE', () => {
  it('is the aud of the Clerk JWT template (ADR-027 decision 1)', () => {
    assert.equal(API_AUDIENCE, 'sudoku-api')
  })
})
