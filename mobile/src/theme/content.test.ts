import { contentInset, contentWidth } from './content'
import { cobalt } from '@/theme/themes/cobalt'

const IPHONE_PRO_MAX = 440
const IPAD_AIR_13 = 1032

describe('contentInset', () => {
  it('keeps the screen margin on an iPhone', () => {
    expect(contentInset(cobalt, IPHONE_PRO_MAX)).toBe(cobalt.space.lg)
  })

  it('centres the content at size.content on an iPad', () => {
    expect(contentInset(cobalt, IPAD_AIR_13)).toBe((IPAD_AIR_13 - cobalt.size.content) / 2)
  })

  it('never gives less than the screen margin', () => {
    expect(contentInset(cobalt, cobalt.size.content)).toBe(cobalt.space.lg)
  })
})

describe('contentWidth', () => {
  it('is the screen width less both margins on an iPhone', () => {
    expect(contentWidth(cobalt, IPHONE_PRO_MAX)).toBe(IPHONE_PRO_MAX - 2 * cobalt.space.lg)
  })

  it('is size.content on an iPad', () => {
    expect(contentWidth(cobalt, IPAD_AIR_13)).toBe(cobalt.size.content)
  })
})
