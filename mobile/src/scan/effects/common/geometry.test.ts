import { intersections, isBoxCorner, pushOutside } from './geometry'
import type { Point, Quad } from '@/utils/geometry.utils'
import { invert, unitToQuad } from '@/utils/homography.utils'

const square: Quad = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
  { x: 100, y: 200 },
]

function near(p: Point) {
  return { x: expect.closeTo(p.x, 6), y: expect.closeTo(p.y, 6) }
}

describe('intersections', () => {
  it('gives 100 points in rows, from the top-left corner to the bottom-right corner', () => {
    const points = intersections(unitToQuad(square)!)
    expect(points).toHaveLength(100)
    expect(points[0]).toEqual(near({ x: 100, y: 100 }))
    expect(points[9]).toEqual(near({ x: 200, y: 100 }))
    expect(points[99]).toEqual(near({ x: 200, y: 200 }))
    expect(points[10]).toEqual(near({ x: 100, y: 100 + 100 / 9 }))
  })
})

describe('isBoxCorner', () => {
  it('marks the 16 points where the box lines cross', () => {
    const corners = Array.from({ length: 100 }, (_, i) => i).filter(isBoxCorner)
    expect(corners).toHaveLength(16)
    expect(corners).toContain(0)
    expect(corners).toContain(33)
    expect(corners).not.toContain(1)
  })
})

describe('pushOutside', () => {
  const m = unitToQuad(square)!
  const inverse = invert(m)!

  it('keeps a point that is already outside the margin', () => {
    const p = { x: 50, y: 150 }
    expect(pushOutside(p, m, inverse, 0.08)).toBe(p)
  })

  it('moves a point inside the grid to the nearest side of the margin', () => {
    expect(pushOutside({ x: 110, y: 150 }, m, inverse, 0.08)).toEqual(near({ x: 92, y: 150 }))
    expect(pushOutside({ x: 150, y: 195 }, m, inverse, 0.08)).toEqual(near({ x: 150, y: 208 }))
  })
})
