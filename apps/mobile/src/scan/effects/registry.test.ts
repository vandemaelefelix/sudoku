import { DEFAULT_EFFECT, DEFAULT_INDEX, EFFECTS, effectAt, effectIndex, findEffect } from './registry'

const FAMILIES = ['path', 'shader', 'screen', 'simulation']

describe('the effect registry', () => {
  it('gives every effect a unique id, a name and a known family', () => {
    const ids = EFFECTS.map((effect) => effect.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const effect of EFFECTS) {
      expect(effect.name.length).toBeGreaterThan(0)
      expect(FAMILIES).toContain(effect.family)
    }
  })

  it('starts on Gathering dots', () => {
    expect(DEFAULT_INDEX).toBe(0)
    expect(DEFAULT_EFFECT.id).toBe('gathering-dots')
  })

  it('finds an effect by id', () => {
    expect(findEffect('gathering-dots')).toBe(EFFECTS[effectIndex('gathering-dots')])
  })

  it('gives the default effect for an unknown id', () => {
    expect(effectIndex('deleted-effect')).toBe(DEFAULT_INDEX)
    expect(findEffect('deleted-effect')).toBe(DEFAULT_EFFECT)
    expect(findEffect(null)).toBe(DEFAULT_EFFECT)
  })

  it('gives the default effect for an index out of range', () => {
    expect(effectAt(EFFECTS.length)).toBe(DEFAULT_EFFECT)
    expect(effectAt(-1)).toBe(DEFAULT_EFFECT)
    expect(effectAt(0.5)).toBe(DEFAULT_EFFECT)
  })
})
