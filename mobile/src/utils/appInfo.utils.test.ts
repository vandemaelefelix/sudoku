import { shortId } from './appInfo.utils'

describe('shortId', () => {
  it('keeps the first eight characters', () => {
    expect(shortId('7f3a91c2-0000-4000-8000-000000000001')).toBe('7f3a91c2')
  })
})
