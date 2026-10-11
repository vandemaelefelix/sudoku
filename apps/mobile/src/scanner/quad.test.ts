import { isConvex, orderCorners, type Point, type Quad, quadArea, toGridDetection, turnHalf } from './quad'

const square: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]

function turn(points: Point[], degrees: number): Point[] {
  const angle = (degrees * Math.PI) / 180
  return points.map((p) => ({
    x: 0.5 + (p.x - 0.5) * Math.cos(angle) - (p.y - 0.5) * Math.sin(angle),
    y: 0.5 + (p.x - 0.5) * Math.sin(angle) + (p.y - 0.5) * Math.cos(angle),
  }))
}

describe('orderCorners', () => {
  it('orders shuffled corners from the top-left, clockwise', () => {
    expect(orderCorners([square[2], square[0], square[3], square[1]])).toEqual(square)
  })

  it('keeps the order for a grid turned by 20 degrees', () => {
    const turned = turn(square, 20)
    expect(orderCorners([turned[3], turned[1], turned[0], turned[2]])).toEqual(turned)
  })

  it('runs clockwise from one corner of a grid turned by 45 degrees', () => {
    const diamond = turn(square, 45)
    const ordered = orderCorners([diamond[2], diamond[0], diamond[1], diamond[3]])
    const start = diamond.indexOf(ordered[0])
    expect(ordered).toEqual([0, 1, 2, 3].map((i) => diamond[(start + i) % 4]))
  })
})

describe('quadArea', () => {
  it('gives the area of a square', () => {
    expect(quadArea(square)).toBeCloseTo(0.36, 10)
  })
})

describe('isConvex', () => {
  it('accepts a square', () => {
    expect(isConvex(square)).toBe(true)
  })

  it('rejects a quad with one corner pushed inwards', () => {
    expect(isConvex([square[0], square[1], { x: 0.4, y: 0.4 }, square[3]])).toBe(false)
  })

  it('rejects three corners on one line', () => {
    expect(isConvex([square[0], { x: 0.5, y: 0.2 }, square[1], square[3]])).toBe(false)
  })
})

describe('toGridDetection', () => {
  const width = 360
  const height = 640
  const pixels: Point[] = [
    { x: 287.5, y: 511.5 },
    { x: 71.5, y: 127.5 },
    { x: 71.5, y: 511.5 },
    { x: 287.5, y: 127.5 },
  ]

  it('normalises pixel corners to the frame and orders them', () => {
    const detection = toGridDetection(pixels, width, height)
    expect(detection).not.toBeNull()
    detection!.quad.forEach((corner, i) => {
      expect(corner.x).toBeCloseTo(square[i].x, 10)
      expect(corner.y).toBeCloseTo(square[i].y, 10)
    })
    expect(detection!.score).toBeCloseTo(0.36, 10)
  })

  it('needs exactly four corners', () => {
    expect(toGridDetection(pixels.slice(0, 3), width, height)).toBeNull()
    expect(toGridDetection([...pixels, { x: 180, y: 100 }], width, height)).toBeNull()
  })

  it('rejects a quad that covers less than a tenth of the frame', () => {
    const small = [
      { x: 0, y: 0 },
      { x: 107, y: 0 },
      { x: 107, y: 191 },
      { x: 0, y: 191 },
    ].map((p) => ({ x: p.x + 100, y: p.y + 200 }))
    expect(toGridDetection(small, width, height)).toBeNull()
  })

  it('rejects a concave quad', () => {
    const concave = [pixels[1], pixels[3], { x: 150, y: 250 }, pixels[2]]
    expect(toGridDetection(concave, width, height)).toBeNull()
  })

  it('rejects a quad that touches the frame border', () => {
    const touching = [{ x: 0, y: 127.5 }, pixels[3], pixels[0], pixels[2]]
    expect(toGridDetection(touching, width, height)).toBeNull()
  })
})

describe('turnHalf', () => {
  it('turns the quad by 180 degrees and keeps the corner order', () => {
    const trapezoid: Quad = [
      { x: 0.25, y: 0.125 },
      { x: 0.5, y: 0.125 },
      { x: 0.875, y: 0.5 },
      { x: 0.125, y: 0.5 },
    ]
    expect(turnHalf(trapezoid)).toEqual([
      { x: 0.125, y: 0.5 },
      { x: 0.875, y: 0.5 },
      { x: 0.75, y: 0.875 },
      { x: 0.5, y: 0.875 },
    ])
  })
})
