import { DARK, LIGHT, useColors } from './colors'

describe('colors', () => {
  it('returns the light colours until dark mode is decided', () => {
    expect(useColors()).toBe(LIGHT)
  })

  it('gives every dark key a light key', () => {
    expect(Object.keys(DARK).toSorted()).toEqual(Object.keys(LIGHT).toSorted())
  })

  it('uses the prototype values', () => {
    expect(LIGHT.background).toBe('#f4f5f8')
    expect(LIGHT.accent).toBe('#2f5bd3')
    expect(DARK.warningSurface).toBe('#3a2a12')
  })
})
