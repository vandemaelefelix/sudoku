import { describe, expect, it } from 'vitest'
import { LEVELS } from '../generator'
import { TECHNIQUE_ORDER } from '../technique/order'
import { GRADE_ORDER, TECHNIQUE_LEVEL } from './levels'

describe('TECHNIQUE_LEVEL', () => {
  it('covers every technique of the solver and nothing else', () => {
    const ids = new Set(TECHNIQUE_ORDER.map((rank) => rank.technique))
    expect(new Set(Object.keys(TECHNIQUE_LEVEL))).toEqual(ids)
    expect(Object.keys(TECHNIQUE_LEVEL)).toHaveLength(ids.size)
  })

  it('gives every technique a level of the game', () => {
    for (const level of Object.values(TECHNIQUE_LEVEL)) expect(LEVELS).toContain(level)
  })
})

const levelOf = (rank: (typeof GRADE_ORDER)[number]) => LEVELS.indexOf(TECHNIQUE_LEVEL[rank.technique])
const indexOfTechnique = (id: string) => GRADE_ORDER.findIndex((rank) => rank.technique === id)

describe('GRADE_ORDER', () => {
  it('has the ranks of TECHNIQUE_ORDER and no more', () => {
    expect(GRADE_ORDER).toHaveLength(TECHNIQUE_ORDER.length)
    for (const rank of TECHNIQUE_ORDER) expect(GRADE_ORDER).toContain(rank)
  })

  it('never lowers the level', () => {
    const levels = GRADE_ORDER.map(levelOf)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy, and the es2022 lib has no toSorted
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })

  it('keeps the order of TECHNIQUE_ORDER inside a level', () => {
    for (const level of LEVELS) {
      const inLevel = (rank: (typeof GRADE_ORDER)[number]) => TECHNIQUE_LEVEL[rank.technique] === level
      expect(GRADE_ORDER.filter(inLevel)).toEqual(TECHNIQUE_ORDER.filter(inLevel))
    }
  })

  it('moves the hidden pair before the X-wing, which TECHNIQUE_ORDER has the other way', () => {
    expect(indexOfTechnique('hiddenPair')).toBeLessThan(indexOfTechnique('xWing'))
  })
})
