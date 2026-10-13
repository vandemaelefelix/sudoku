import { easeIn, easeOut } from './motion.utils'

describe('easeOut', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
  })

  it('covers most of the distance in the first half', () => {
    expect(easeOut(0.25)).toBeGreaterThan(0.75)
    expect(easeOut(0.5)).toBeCloseTo(0.96875, 12)
  })
})

describe('easeIn', () => {
  it('starts at 0, ends at 1 and stays slow in the first half', () => {
    expect(easeIn(0)).toBe(0)
    expect(easeIn(1)).toBe(1)
    expect(easeIn(0.5)).toBeLessThan(0.25)
  })
})
