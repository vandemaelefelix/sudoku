import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ACCOUNT_STAGE, CLERK_ISSUER, STAGES, deployPlan, hasClerk } from './config.ts'

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

describe('deployPlan', () => {
  it('gives a stage with a Clerk issuer the whole app, so felix and dev deploy as before', () => {
    assert.deepEqual(deployPlan('felix'), { account: false, app: true })
    assert.deepEqual(deployPlan('dev'), { account: false, app: true })
  })

  it('gives production only the account-wide resources while it has no issuer', () => {
    assert.equal(ACCOUNT_STAGE, 'production')
    assert.deepEqual(deployPlan('production'), { account: true, app: false })
  })

  it('gives production the whole app as soon as it has an issuer', () => {
    assert.deepEqual(deployPlan('production', { ...CLERK_ISSUER, production: 'https://clerk.example.com' }), {
      account: true,
      app: true,
    })
  })

  it('throws for felix and dev without an issuer, so a removed issuer never deletes their table', () => {
    assert.throws(() => deployPlan('felix', { ...CLERK_ISSUER, felix: null }), /felix has no Clerk issuer/)
    assert.throws(() => deployPlan('dev', { ...CLERK_ISSUER, dev: null }), /dev has no Clerk issuer/)
  })

  it('lets only the account stage skip the app', () => {
    for (const stage of STAGES) {
      const issuers = { ...CLERK_ISSUER, [stage]: null }
      if (stage === ACCOUNT_STAGE) assert.equal(deployPlan(stage, issuers).app, false)
      else assert.throws(() => deployPlan(stage, issuers))
    }
  })

  it('creates the account-wide resources only on the account stage', () => {
    for (const stage of STAGES) assert.equal(deployPlan(stage).account, stage === ACCOUNT_STAGE)
  })
})
