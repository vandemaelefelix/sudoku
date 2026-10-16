import { deviceTimeZone } from './timeZone.utils'

it('gives an IANA time zone that Intl accepts', () => {
  const zone = deviceTimeZone()
  expect(zone.length).toBeGreaterThan(0)
  expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone })).not.toThrow()
})
