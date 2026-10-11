import { spreadStep } from './spread'

describe('spreadStep', () => {
  it('pushes two close points apart along the line between them', () => {
    const next = spreadStep(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [true, true],
      20,
      2,
    )
    expect(next[0]).toEqual({ x: -1, y: 0 })
    expect(next[1]).toEqual({ x: 11, y: 0 })
  })

  it('leaves points that are further apart than the radius', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    ]
    expect(spreadStep(points, [true, true], 20, 2)).toEqual(points)
  })

  it('does not move a fixed point, but it still pushes', () => {
    const next = spreadStep(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [false, true],
      20,
      2,
    )
    expect(next[0]).toEqual({ x: 0, y: 0 })
    expect(next[1]).toEqual({ x: 11, y: 0 })
  })

  it('does not change its input', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    spreadStep(points, [true, true], 20, 2)
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
  })

  it('ignores two points on the same spot', () => {
    const next = spreadStep(
      [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
      [true, true],
      20,
      2,
    )
    expect(next).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ])
  })

  it('gives the same result as a full pairwise pass', () => {
    let seed = 12345
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const radius = 43.55
    const push = 1.675
    const points = Array.from({ length: 200 }, () => ({ x: random() * 402, y: random() * 874 }))
    const movable = points.map(() => random() < 0.7)
    const expected = points.map((p) => ({ ...p }))
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        const dx = points[a].x - points[b].x
        const dy = points[a].y - points[b].y
        const distance = Math.hypot(dx, dy)
        if (distance >= radius || distance < 1e-6) continue
        const k = ((radius - distance) / radius) * push
        if (movable[a]) {
          expected[a].x += (dx / distance) * k
          expected[a].y += (dy / distance) * k
        }
        if (movable[b]) {
          expected[b].x -= (dx / distance) * k
          expected[b].y -= (dy / distance) * k
        }
      }
    }
    const next = spreadStep(points, movable, radius, push)
    expect(next.some((p, i) => p.x !== points[i].x)).toBe(true)
    for (let i = 0; i < points.length; i++) {
      expect(Math.abs(next[i].x - expected[i].x)).toBeLessThan(1e-9)
      expect(Math.abs(next[i].y - expected[i].y)).toBeLessThan(1e-9)
    }
  })
})
