import { cornerOffset, downscaleSize, fromCrop, searchRect, toPhotoPixels } from './photoGeometry'
import type { Quad } from './quad'

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
