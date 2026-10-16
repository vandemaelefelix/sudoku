import { scanApiOf, shortId } from './scanConfig'

describe('scanApiOf', () => {
  it('needs an https URL and an app key', () => {
    expect(scanApiOf({ syncApiUrl: 'https://api.example/', scanAppKey: 'k' })).toEqual({
      baseUrl: 'https://api.example',
      appKey: 'k',
    })
    expect(scanApiOf({ syncApiUrl: 'https://api.example' })).toBeNull()
    expect(scanApiOf({ syncApiUrl: 'https://api.example', scanAppKey: '' })).toBeNull()
    expect(scanApiOf({ syncApiUrl: 'http://api.example', scanAppKey: 'k' })).toBeNull()
    expect(scanApiOf(undefined)).toBeNull()
  })
})

describe('shortId', () => {
  it('keeps the first eight characters', () => {
    expect(shortId('7f3a91c2-0000-4000-8000-000000000001')).toBe('7f3a91c2')
  })
})
