import { createDots, DOT_SPACING, twinkle, wander, WANDER_MAX } from './layout'

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}

describe('createDots', () => {
  it('lays out 12 × 26 = 312 dots on the reference view', () => {
    expect(createDots({ width: 402, height: 874 })).toHaveLength(312)
  })

  it('keeps the same density on another size', () => {
    expect(createDots({ width: 804, height: 874 })).toHaveLength(24 * 26)
  })

  it('gives at least one dot on a tiny view', () => {
    expect(createDots({ width: 10, height: 10 })).toHaveLength(1)
  })

  it('keeps every dot in its own cell, moved by at most 30 %', () => {
    const dots = createDots({ width: 402, height: 874 })
    const cellWidth = 402 / 12
    dots.forEach((dot, i) => {
      const centre = ((i % 12) + 0.5) * cellWidth
      expect(Math.abs(dot.homeX - centre)).toBeLessThanOrEqual(0.3 * cellWidth + 1e-9)
    })
  })

  it('gives the same layout every time', () => {
    expect(createDots({ width: 402, height: 874 })).toEqual(createDots({ width: 402, height: 874 }))
  })

  it('keeps sizes, wander and twinkle in the ranges of the design', () => {
    for (const dot of createDots({ width: 402, height: 874 })) {
      expect(dot.size).toBeGreaterThanOrEqual(0.75)
      expect(dot.size).toBeLessThanOrEqual(1.25)
      expect(dot.ax).toBeGreaterThanOrEqual(5)
      expect(dot.ax).toBeLessThanOrEqual(9)
      expect(dot.fx).toBeGreaterThanOrEqual(0.5)
      expect(dot.fx).toBeLessThanOrEqual(1.1)
      expect(dot.tw).toBeGreaterThanOrEqual(1.2)
      expect(dot.tw).toBeLessThanOrEqual(3.4)
    }
  })

  it('uses a spacing of 33.5 pt', () => {
    expect(DOT_SPACING).toBe(33.5)
  })
})

describe('wander', () => {
  it('never moves a dot further than its amplitude on each axis', () => {
    const dot = itemAt(createDots({ width: 402, height: 874 }), 7)
    for (let t = 0; t < 60; t += 0.05) {
      const w = wander(dot, t)
      expect(Math.abs(w.x)).toBeLessThanOrEqual(dot.ax + 1e-9)
      expect(Math.abs(w.y)).toBeLessThanOrEqual(WANDER_MAX + 1e-9)
    }
  })

  it('keeps moving', () => {
    const dot = itemAt(createDots({ width: 402, height: 874 }), 7)
    expect(wander(dot, 1)).not.toEqual(wander(dot, 1.5))
  })
})

describe('twinkle', () => {
  it('changes the opacity by at most 28 %', () => {
    const dot = itemAt(createDots({ width: 402, height: 874 }), 3)
    for (let t = 0; t < 20; t += 0.1) {
      expect(twinkle(dot, t)).toBeGreaterThanOrEqual(0.72 - 1e-9)
      expect(twinkle(dot, t)).toBeLessThanOrEqual(1.28 + 1e-9)
    }
  })
})
