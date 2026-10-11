import { spreadStep } from './spread'

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}

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
        const dx = itemAt(points, a).x - itemAt(points, b).x
        const dy = itemAt(points, a).y - itemAt(points, b).y
        const distance = Math.hypot(dx, dy)
        if (distance >= radius || distance < 1e-6) continue
        const k = ((radius - distance) / radius) * push
        if (movable[a]) {
          itemAt(expected, a).x += (dx / distance) * k
          itemAt(expected, a).y += (dy / distance) * k
        }
        if (movable[b]) {
          itemAt(expected, b).x -= (dx / distance) * k
          itemAt(expected, b).y -= (dy / distance) * k
        }
      }
    }
    const next = spreadStep(points, movable, radius, push)
    expect(next.some((p, i) => p.x !== itemAt(points, i).x)).toBe(true)
    for (const [i, e] of expected.entries()) {
      expect(Math.abs(itemAt(next, i).x - e.x)).toBeLessThan(1e-9)
      expect(Math.abs(itemAt(next, i).y - e.y)).toBeLessThan(1e-9)
    }
  })
})
