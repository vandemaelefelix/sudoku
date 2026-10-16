import { describe, expect, it } from 'vitest'
import { apiUrlFrom, assertSmokeAllowed, report } from '../../scripts/smokeChecks.ts'

describe('apiUrlFrom', () => {
  it('reads apiUrl from .sst/outputs.json', () => {
    expect(apiUrlFrom({ apiUrl: 'https://abc.execute-api.eu-west-1.amazonaws.com' })).toBe(
      'https://abc.execute-api.eu-west-1.amazonaws.com',
    )
  })

  it('refuses outputs without an https apiUrl', () => {
    expect(() => apiUrlFrom({})).toThrow(/just deploy-api/)
    expect(() => apiUrlFrom({ apiUrl: 'http://x' })).toThrow(/just deploy-api/)
  })
})

describe('assertSmokeAllowed', () => {
  it('accepts felix and dev with a development key', () => {
    expect(() => assertSmokeAllowed('felix', 'sk_test_abc')).not.toThrow(Error)
    expect(() => assertSmokeAllowed('dev', 'sk_test_abc')).not.toThrow(Error)
  })

  it('refuses production, a live key and a missing key', () => {
    expect(() => assertSmokeAllowed('production', 'sk_test_abc')).toThrow(/production/)
    expect(() => assertSmokeAllowed('felix', 'sk_live_abc')).toThrow(/development instance/)
    expect(() => assertSmokeAllowed('felix', undefined)).toThrow(/CLERK_SECRET_KEY/)
  })
})

describe('report', () => {
  it('prints one row per check and passes only when every check passes', () => {
    const { text, passed } = report([
      { name: 'no token -> 401', ok: true, detail: '401' },
      { name: 'throttle -> 429', ok: false, detail: 'no 429 in 15 requests' },
    ])
    expect(passed).toBe(false)
    expect(text).toContain('PASS  no token -> 401')
    expect(text).toContain('FAIL  throttle -> 429')
  })
})
