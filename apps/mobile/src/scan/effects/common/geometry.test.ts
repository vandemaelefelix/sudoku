import type { Point, Quad } from '../../../scanner'
import { intersections, invert, isBoxCorner, project, pushOutside, unitToQuad } from './geometry'

const skewed: Quad = [
  { x: 100, y: 200 },
  { x: 300, y: 190 },
  { x: 330, y: 420 },
  { x: 80, y: 400 },
]

const square: Quad = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
  { x: 100, y: 200 },
]

function near(p: Point) {
  return { x: expect.closeTo(p.x, 6), y: expect.closeTo(p.y, 6) }
}

describe('unitToQuad', () => {
  it('returns null for a quad with a NaN corner', () => {
    expect(unitToQuad([{ x: NaN, y: 0 }, square[1], square[2], square[3]])).toBeNull()
  })

  it('maps the unit square corners onto the quad corners', () => {
    const m = unitToQuad(skewed)!
    expect(project(m, 0, 0)).toEqual(near(skewed[0]))
    expect(project(m, 1, 0)).toEqual(near(skewed[1]))
    expect(project(m, 1, 1)).toEqual(near(skewed[2]))
    expect(project(m, 0, 1)).toEqual(near(skewed[3]))
  })

  it('maps the centre of a square to its centre', () => {
    expect(project(unitToQuad(square)!, 0.5, 0.5)).toEqual(near({ x: 150, y: 150 }))
  })

  it('refuses a quad whose last three corners lie on one line', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 200 },
    ]
    expect(unitToQuad(flat)).toBeNull()
  })
})

describe('invert', () => {
  it('returns null for a matrix with a NaN entry', () => {
    expect(invert([NaN, 0, 0, 0, 1, 0, 0, 0])).toBeNull()
  })

  it('has no inverse when the first three corners lie on one line', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ]
    expect(invert(unitToQuad(flat)!)).toBeNull()
  })

  it('maps the quad corners back to the unit square', () => {
    const m = unitToQuad(skewed)!
    const inverse = invert(m)!
    expect(project(inverse, skewed[2].x, skewed[2].y)).toEqual(near({ x: 1, y: 1 }))
    const p = project(m, 0.3, 0.7)
    expect(project(inverse, p.x, p.y)).toEqual(near({ x: 0.3, y: 0.7 }))
  })
})

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
