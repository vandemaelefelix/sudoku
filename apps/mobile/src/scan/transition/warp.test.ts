import type { Point, Quad } from '@/scanner'
import { toPreview } from '@/scan/previewMapping'
import { lerpQuad, photoMatrix, quadToQuad, rectQuad } from './warp'

const trapezoid: Quad = [
  { x: 120, y: 80 },
  { x: 300, y: 100 },
  { x: 340, y: 360 },
  { x: 90, y: 330 },
]
const square: Quad = [
  { x: 16, y: 134 },
  { x: 386, y: 134 },
  { x: 386, y: 504 },
  { x: 16, y: 504 },
]

function apply(h: number[], p: Point): Point {
  const at = (i: number) => h[i] ?? Number.NaN
  const w = at(6) * p.x + at(7) * p.y + at(8)
  return { x: (at(0) * p.x + at(1) * p.y + at(2)) / w, y: (at(3) * p.x + at(4) * p.y + at(5)) / w }
}

function corners(a: Quad, b: Quad): [Point, Point][] {
  return [
    [a[0], b[0]],
    [a[1], b[1]],
    [a[2], b[2]],
    [a[3], b[3]],
  ]
}

describe('lerpQuad', () => {
  it('returns the ends and the middle', () => {
    expect(lerpQuad(trapezoid, square, 0)).toEqual(trapezoid)
    expect(lerpQuad(trapezoid, square, 1)).toEqual(square)
    const mid = lerpQuad(trapezoid, square, 0.5)
    expect(mid[0]).toEqual({ x: 68, y: 107 })
    expect(mid[2]).toEqual({ x: 363, y: 432 })
  })
})

describe('rectQuad', () => {
  it('lists the corners clockwise from the top left', () => {
    expect(rectQuad({ x: 16, y: 134, width: 370, height: 370 })).toEqual(square)
  })
})

describe('quadToQuad', () => {
  it('maps each corner of a onto b', () => {
    const h = quadToQuad(trapezoid, square)
    expect(h).not.toBeNull()
    expect(h).toHaveLength(9)
    expect(h?.[8]).toBeCloseTo(1, 12)
    for (const [from, to] of corners(trapezoid, square)) {
      const p = apply(h as number[], from)
      expect(p.x).toBeCloseTo(to.x, 6)
      expect(p.y).toBeCloseTo(to.y, 6)
    }
  })

  it('maps a quad onto itself as the identity', () => {
    const h = quadToQuad(trapezoid, trapezoid) as number[]
    const p = apply(h, { x: 200, y: 200 })
    expect(p.x).toBeCloseTo(200, 6)
    expect(p.y).toBeCloseTo(200, 6)
  })

  it('returns null for a degenerate quad', () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]
    expect(quadToQuad(line, square)).toBeNull()
    expect(quadToQuad(square, line)).toBeNull()
  })
})

describe('photoMatrix', () => {
  const locked: Quad = [
    { x: 0.2, y: 0.25 },
    { x: 0.8, y: 0.22 },
    { x: 0.85, y: 0.7 },
    { x: 0.15, y: 0.75 },
  ]

  it('maps the locked corners in photo pixels onto the screen quad', () => {
    const h = photoMatrix(3000, 4000, locked, square) as number[]
    for (const [from, to] of corners(locked, square)) {
      const p = apply(h, { x: from.x * 3000, y: from.y * 4000 })
      expect(p.x).toBeCloseTo(to.x, 6)
      expect(p.y).toBeCloseTo(to.y, 6)
    }
  })

  it('reproduces the cover mapping when the screen quad is the preview quad', () => {
    const view = { width: 402, height: 874 }
    const aspect = 3 / 4
    const screen = toPreview(locked, aspect, view) as Quad
    const h = photoMatrix(3000, 4000, locked, screen) as number[]
    const corner = toPreview(
      [
        { x: 1, y: 1 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      aspect,
      view,
    ) as Quad
    const p = apply(h, { x: 3000, y: 4000 })
    expect(p.x).toBeCloseTo(corner[0].x, 6)
    expect(p.y).toBeCloseTo(corner[0].y, 6)
    const origin = apply(h, { x: 0, y: 0 })
    const expected = toPreview(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      aspect,
      view,
    ) as Quad
    expect(origin.x).toBeCloseTo(expected[0].x, 6)
    expect(origin.y).toBeCloseTo(expected[0].y, 6)
  })

  it('returns null for a degenerate locked quad', () => {
    const point = { x: 0.5, y: 0.5 }
    expect(photoMatrix(3000, 4000, [point, point, point, point], square)).toBeNull()
  })
})
