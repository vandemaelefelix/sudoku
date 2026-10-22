import { columnInset, columnWidth } from './column'
import { cobalt } from '@/theme/themes/cobalt'

const IPHONE_PRO_MAX = 440
const IPAD_AIR_13 = 1032

describe('columnInset', () => {
  it('keeps the screen margin on an iPhone', () => {
    expect(columnInset(cobalt, IPHONE_PRO_MAX)).toBe(cobalt.space.lg)
  })

  it('centres a column of size.column on an iPad', () => {
    expect(columnInset(cobalt, IPAD_AIR_13)).toBe((IPAD_AIR_13 - cobalt.size.column) / 2)
  })

  it('never gives less than the screen margin', () => {
    expect(columnInset(cobalt, cobalt.size.column)).toBe(cobalt.space.lg)
  })
})

describe('columnWidth', () => {
  it('is the screen width less both margins on an iPhone', () => {
    expect(columnWidth(cobalt, IPHONE_PRO_MAX)).toBe(IPHONE_PRO_MAX - 2 * cobalt.space.lg)
  })

  it('is size.column on an iPad', () => {
    expect(columnWidth(cobalt, IPAD_AIR_13)).toBe(cobalt.size.column)
  })
})
