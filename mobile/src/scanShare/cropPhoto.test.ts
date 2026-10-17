import { MAX_JPEG_BYTES } from '@sudoku/scan-contract'
import type { Quad } from '@/utils/geometry.utils'
import { cropPhoto, cropRegion, type ImageCodec } from './cropPhoto'

// A grid in the middle of a 3000 x 4000 photo.
const QUAD: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.6 },
  { x: 0.2, y: 0.6 },
]
const PHOTO = { width: 3000, height: 4000 }

it('crops to the grid plus a margin and keeps the corners inside the crop', () => {
  const { source, corners } = cropRegion(QUAD, PHOTO)
  expect(source.x).toBeLessThan(0.2 * 3000)
  expect(source.x + source.width).toBeGreaterThan(0.8 * 3000)
  expect(source.y).toBeLessThan(0.3 * 4000)
  expect(source.y + source.height).toBeGreaterThan(0.6 * 4000)
  for (const [x, y] of corners) {
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(1)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(1)
  }
})

it('limits the long side to 1600 px and keeps the aspect', () => {
  const { source, out } = cropRegion(QUAD, PHOTO)
  expect(Math.max(out.width, out.height)).toBe(1600)
  expect(out.width / out.height).toBeCloseTo(source.width / source.height, 2)
})

it('does not enlarge a small crop', () => {
  const { out } = cropRegion(QUAD, { width: 300, height: 400 })
  expect(out.width).toBeLessThanOrEqual(300)
})

it('stays inside the photo when the grid touches the edge', () => {
  const edge: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
  const { source, corners } = cropRegion(edge, PHOTO)
  expect(source).toEqual({ x: 0, y: 0, width: 3000, height: 4000 })
  expect(corners).toEqual([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ])
})

function codec(sizes: number[]): ImageCodec & { renders: number } {
  const state = { renders: 0 }
  return {
    get renders() {
      return state.renders
    },
    size: async () => PHOTO,
    render: async () => new Uint8Array(sizes[Math.min(state.renders++, sizes.length - 1)] ?? 0),
  }
}

it('returns the JPEG at the first quality that fits MAX_JPEG_BYTES', async () => {
  const fake = codec([MAX_JPEG_BYTES + 1, 500])
  const cropped = await cropPhoto(fake, 'file:///photo.jpg', QUAD)
  expect(cropped.jpeg.length).toBe(500)
  expect(fake.renders).toBe(2)
  expect(Math.max(cropped.width, cropped.height)).toBeLessThanOrEqual(1600)
})

it('throws when no quality fits', async () => {
  await expect(cropPhoto(codec([MAX_JPEG_BYTES + 1]), 'file:///photo.jpg', QUAD)).rejects.toThrow(RangeError)
})
