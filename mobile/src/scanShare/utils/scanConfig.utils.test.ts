import { scanApiOf } from './scanConfig.utils'

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
