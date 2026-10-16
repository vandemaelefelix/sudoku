import type { Point, Quad } from './geometry.utils'
import { invert, project, quadToQuad, unitToQuad } from './homography.utils'

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

const trapezoid: Quad = [
  { x: 120, y: 80 },
  { x: 300, y: 100 },
  { x: 340, y: 360 },
  { x: 90, y: 330 },
]

const board: Quad = [
  { x: 16, y: 134 },
  { x: 386, y: 134 },
  { x: 386, y: 504 },
  { x: 16, y: 504 },
]

function near(p: Point) {
  return { x: expect.closeTo(p.x, 6), y: expect.closeTo(p.y, 6) }
}

function apply(h: number[], p: Point): Point {
  const at = (i: number) => h[i] ?? Number.NaN
  const w = at(6) * p.x + at(7) * p.y + at(8)
  return { x: (at(0) * p.x + at(1) * p.y + at(2)) / w, y: (at(3) * p.x + at(4) * p.y + at(5)) / w }
}

function expectMaps(a: Quad, b: Quad): number[] {
  const h = quadToQuad(a, b)
  expect(h).not.toBeNull()
  expect(h).toHaveLength(9)
  expect(h?.[8]).toBeCloseTo(1, 12)
  const matrix = h ?? []
  a.forEach((from, i) => expect(apply(matrix, from)).toEqual(near(b[i] ?? { x: Number.NaN, y: Number.NaN })))
  return matrix
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

describe('quadToQuad', () => {
  it('maps each corner of a onto b', () => {
    expect(expectMaps(trapezoid, board)).toHaveLength(9)
  })

  it('maps a quad onto itself as the identity', () => {
    const h = expectMaps(trapezoid, trapezoid)
    expect(apply(h, { x: 200, y: 200 })).toEqual(near({ x: 200, y: 200 }))
  })

  it('maps a pure scale and shift', () => {
    const unit: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]
    const box: Quad = [
      { x: 5, y: 7 },
      { x: 25, y: 7 },
      { x: 25, y: 47 },
      { x: 5, y: 47 },
    ]
    expect(apply(expectMaps(unit, box), { x: 0.5, y: 0.5 })).toEqual(near({ x: 15, y: 27 }))
  })

  it('maps a photo grid in pixels onto the 576 square of the scanner', () => {
    const photo: Quad = [
      { x: 1200, y: 800 },
      { x: 3000, y: 900 },
      { x: 3300, y: 2100 },
      { x: 900, y: 2000 },
    ]
    const flat: Quad = [
      { x: -0.5, y: -0.5 },
      { x: 575.5, y: -0.5 },
      { x: 575.5, y: 575.5 },
      { x: -0.5, y: 575.5 },
    ]
    expect(expectMaps(photo, flat)).toHaveLength(9)
  })

  it('returns null for a degenerate quad', () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]
    expect(quadToQuad(line, board)).toBeNull()
    expect(quadToQuad(board, line)).toBeNull()
  })

  it('returns null when three corners lie on one line', () => {
    const bent: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 5 },
    ]
    expect(quadToQuad(bent, square)).toBeNull()
  })
})
