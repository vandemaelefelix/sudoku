import { describe, expect, it } from 'vitest'
import { hasAppKey } from '../../src/scans/appKey'

describe('hasAppKey', () => {
  it('accepts the exact key', () => {
    expect(hasAppKey('abc123', 'abc123')).toBe(true)
  })

  it.each([undefined, '', 'abc12', 'abc1234', 'ABC123'])('refuses %j', (given) => {
    expect(hasAppKey(given, 'abc123')).toBe(false)
  })

  it('refuses everything when no key is configured', () => {
    expect(hasAppKey('', '')).toBe(false)
  })
})
