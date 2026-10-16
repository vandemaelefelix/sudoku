import { sameAspect, toPreview, uprightAspect } from './preview.utils'
import type { Quad } from '@/utils/geometry.utils'

const corners: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

describe('uprightAspect', () => {
  it('swaps the sides of a frame that lies sideways', () => {
    expect(uprightAspect(1920, 1080, 'right')).toBeCloseTo(0.5625, 10)
    expect(uprightAspect(1920, 1080, 'left')).toBeCloseTo(0.5625, 10)
  })

  it('keeps the sides of an upright or upside-down frame', () => {
    expect(uprightAspect(1080, 1920, 'up')).toBeCloseTo(0.5625, 10)
    expect(uprightAspect(1080, 1920, 'down')).toBeCloseTo(0.5625, 10)
  })
})

describe('toPreview', () => {
  it('scales the frame to a view of the same shape', () => {
    expect(toPreview(corners, 0.5625, { width: 360, height: 640 })).toEqual([
      { x: 0, y: 0 },
      { x: 360, y: 0 },
      { x: 360, y: 640 },
      { x: 0, y: 640 },
    ])
  })

  it('crops the sides when the view is narrower than the frame', () => {
    const quad = toPreview(corners, 0.5625, { width: 400, height: 800 })!
    expect(quad[0].x).toBeCloseTo(-25, 10)
    expect(quad[0].y).toBeCloseTo(0, 10)
    expect(quad[2].x).toBeCloseTo(425, 10)
    expect(quad[2].y).toBeCloseTo(800, 10)
  })

  it('crops the top and bottom when the view is wider than the frame', () => {
    const quad = toPreview(corners, 0.5625, { width: 600, height: 800 })!
    expect(quad[0].x).toBeCloseTo(0, 10)
    expect(quad[0].y).toBeCloseTo(-400 / 3, 10)
    expect(quad[2].y).toBeCloseTo(800 + 400 / 3, 10)
  })

  it('maps the centre of the frame to the centre of the view', () => {
    const centre: Quad = [corners[0], corners[1], { x: 0.5, y: 0.5 }, corners[3]]
    expect(toPreview(centre, 0.5625, { width: 400, height: 800 })![2]).toEqual({ x: 200, y: 400 })
  })

  it('has no outline before the view has a size', () => {
    expect(toPreview(corners, 0.5625, { width: 0, height: 0 })).toBeNull()
  })

  it('has no outline when the frame shape is unknown', () => {
    expect(toPreview(corners, Number.NaN, { width: 400, height: 800 })).toBeNull()
  })
})

describe('sameAspect', () => {
  it('accepts the 16:9 photo against a 16:9 frame', () => {
    expect(sameAspect(2376 / 4224, 1080 / 1920)).toBe(true)
  })

  it('refuses a 4:3 frame against a 16:9 photo', () => {
    expect(sameAspect(2376 / 4224, 3 / 4)).toBe(false)
  })

  it('refuses an aspect that is not a positive number', () => {
    expect(sameAspect(0, 9 / 16)).toBe(false)
    expect(sameAspect(9 / 16, Number.NaN)).toBe(false)
  })
})
