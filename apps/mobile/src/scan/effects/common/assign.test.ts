import { assignNearest } from './assign'

describe('assignNearest', () => {
  it('gives every target exactly one dot, and no dot twice', () => {
    const dots = Array.from({ length: 50 }, (_, i) => ({ x: (i % 10) * 10, y: Math.floor(i / 10) * 10 }))
    const targets = Array.from({ length: 20 }, (_, i) => ({ x: 3 + (i % 5) * 9, y: 4 + Math.floor(i / 5) * 9 }))
    const owner = assignNearest(dots, targets)
    expect(owner).toHaveLength(20)
    expect(owner.every((i) => i >= 0)).toBe(true)
    expect(new Set(owner).size).toBe(20)
  })

  it('serves the shortest pair first', () => {
    const dots = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    const targets = [{ x: 10, y: 0 }, { x: 1, y: 0 }]
    expect(assignNearest(dots, targets)).toEqual([1, 0])
  })

  it('gives each target its nearest dot when the dots do not compete', () => {
    const dots = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]
    const targets = [{ x: 98, y: 0 }, { x: 2, y: 0 }]
    expect(assignNearest(dots, targets)).toEqual([2, 0])
  })

  it('leaves intersections without a dot when there are too few dots', () => {
    const dots = [{ x: 0, y: 0 }]
    const targets = [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 0 }]
    expect(assignNearest(dots, targets)).toEqual([0, -1, -1])
  })

  it('still finds a dot when all near candidates are taken', () => {
    const dots = Array.from({ length: 12 }, (_, i) => ({ x: i, y: 0 })).concat([{ x: 500, y: 0 }])
    const targets = Array.from({ length: 13 }, () => ({ x: 0, y: 0 }))
    const owner = assignNearest(dots, targets)
    expect(new Set(owner).size).toBe(13)
    expect(owner).toContain(12)
  })
})
