import { cornerOffset, downscaleSize, fromCrop, perspectiveTransform, searchRect, toPhotoPixels } from './photoGeometry'
import type { Quad } from './quad'

function at<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}

function square(x: number, y: number, size: number): Quad {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

describe('downscaleSize', () => {
  it('keeps the live long side and the photo aspect ratio', () => {
    expect(downscaleSize(2160, 3840)).toEqual({ width: 360, height: 640 })
    expect(downscaleSize(3840, 2160)).toEqual({ width: 640, height: 360 })
    expect(downscaleSize(3024, 4032)).toEqual({ width: 480, height: 640 })
  })
})

describe('toPhotoPixels', () => {
  it('maps the normalised quad to OpenCV pixels of an upright photo', () => {
    expect(toPhotoPixels(square(0.25, 0.5, 0.25), 2160, 3840)[0]).toEqual({ x: 539.5, y: 1919.5 })
  })

  it('maps the same quad to a landscape photo', () => {
    expect(toPhotoPixels(square(0.25, 0.5, 0.25), 3840, 2160)[2]).toEqual({ x: 1919.5, y: 1619.5 })
  })
})

describe('searchRect', () => {
  it('grows the bounding box by grow times its size on each side', () => {
    const quad: Quad = [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.5 },
      { x: 0.25, y: 0.5 },
    ]
    expect(searchRect(quad, 360, 640, 0.1)).toEqual({ x: 72, y: 144, width: 216, height: 192 })
  })

  it('clamps the box to the image', () => {
    expect(searchRect(square(0.02, 0.02, 0.96), 360, 640, 0.1)).toEqual({ x: 0, y: 0, width: 360, height: 640 })
  })
})

describe('fromCrop', () => {
  it('maps a quad normalised to the crop back to the whole image', () => {
    const quad = fromCrop(square(0.5, 0.5, 0.25), { x: 72, y: 144, width: 216, height: 192 }, 360, 640)
    expect(quad[0].x).toBeCloseTo(0.5, 9)
    expect(quad[0].y).toBeCloseTo(0.375, 9)
  })
})

describe('cornerOffset', () => {
  it('is 0 for the same quad', () => {
    expect(cornerOffset(square(0.2, 0.2, 0.5), square(0.2, 0.2, 0.5), 100, 100)).toBe(0)
  })

  it('gives the largest corner distance as a share of the mean side', () => {
    const moved = square(0.2, 0.2, 0.5)
    moved[2] = { x: 0.72, y: 0.7 }
    expect(cornerOffset(moved, square(0.2, 0.2, 0.5), 100, 100)).toBeCloseTo(0.04, 9)
  })
})

function apply(h: number[], p: { x: number; y: number }) {
  const w = at(h, 6) * p.x + at(h, 7) * p.y + at(h, 8)
  return {
    x: (at(h, 0) * p.x + at(h, 1) * p.y + at(h, 2)) / w,
    y: (at(h, 3) * p.x + at(h, 4) * p.y + at(h, 5)) / w,
  }
}

type Pt = { x: number; y: number }

function expectMaps(from: Pt[], to: Pt[]): number[] {
  const h = perspectiveTransform(from, to)
  expect(h).toHaveLength(9)
  expect(h[8]).toBe(1)
  from.forEach((p, i) => {
    const mapped = apply(h, p)
    expect(mapped.x).toBeCloseTo(at(to, i).x, 6)
    expect(mapped.y).toBeCloseTo(at(to, i).y, 6)
  })
  return h
}

describe('perspectiveTransform', () => {
  it('maps a pure scale and shift', () => {
    const h = expectMaps(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      [
        { x: 5, y: 7 },
        { x: 25, y: 7 },
        { x: 25, y: 47 },
        { x: 5, y: 47 },
      ],
    )
    expect(apply(h, { x: 0.5, y: 0.5 })).toEqual({ x: 15, y: 27 })
  })

  it('maps a real trapezoid to the 576 square', () => {
    const h = expectMaps(
      [
        { x: 1200, y: 800 },
        { x: 3000, y: 900 },
        { x: 3300, y: 2100 },
        { x: 900, y: 2000 },
      ],
      [
        { x: -0.5, y: -0.5 },
        { x: 575.5, y: -0.5 },
        { x: 575.5, y: 575.5 },
        { x: -0.5, y: 575.5 },
      ],
    )
    expect(h).toHaveLength(9)
  })

  it('maps the centre of a square to the centre for an affine case', () => {
    const h = expectMaps(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    )
    const centre = apply(h, { x: 5, y: 5 })
    expect(centre.x).toBeCloseTo(50, 6)
    expect(centre.y).toBeCloseTo(50, 6)
  })

  it('throws for three collinear points', () => {
    expect(() =>
      perspectiveTransform(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 0, y: 5 },
        ],
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      ),
    ).toThrow('the corners do not give a perspective transform')
  })
})
