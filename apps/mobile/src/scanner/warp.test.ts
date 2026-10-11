import { Mat, OpenCV } from 'react-native-fast-opencv'
import { warpGrid } from './warp'
import type { Quad } from '@/utils/geometry.utils'

type Fake = { release: jest.Mock }
const created: Fake[] = []
function mockFake<T extends object>(extra: T): T & Fake {
  const object = { ...extra, release: jest.fn() }
  created.push(object)
  return object
}

jest.mock('react-native-fast-opencv', () => ({
  BorderTypes: { BORDER_REPLICATE: 1 },
  DataTypes: { CV_8U: 0, CV_64F: 6 },
  InterpolationFlags: { INTER_LINEAR: 1 },
  Mat: {
    createFromBuffer: jest.fn((_type: string, rows: number, cols: number) => mockFake({ rows, cols })),
    create: jest.fn(() => mockFake({ toBuffer: () => ({ buffer: new Uint8Array(4 * 4 * 4).fill(7) }) })),
  },
  Size: { create: jest.fn(() => mockFake({})) },
  Scalar: { create: jest.fn(() => mockFake({})) },
  OpenCV: { warpPerspective: jest.fn() },
}))

const corners: Quad = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
]

function at<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}

beforeEach(() => {
  created.length = 0
  jest.clearAllMocks()
})

it('returns side × side pixels in the source format', () => {
  const out = warpGrid(
    { buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' },
    corners,
    4,
  )
  expect(out).toMatchObject({ width: 4, height: 4, pixelFormat: 'BGRA' })
  expect(new Uint8Array(out.buffer)).toHaveLength(64)
  expect(new Uint8Array(out.buffer)[0]).toBe(7)
})

it('reads a padded row as extra columns', () => {
  warpGrid({ buffer: new ArrayBuffer(100 * 104 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  expect(at(jest.mocked(Mat.createFromBuffer).mock.calls, 0).slice(1, 4)).toEqual([100, 104, 4])
})

it('builds the transform in TypeScript from the corners to the edges of the square', () => {
  warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  const call = jest.mocked(Mat.create).mock.calls.find((c) => c[2] === 6)
  if (call == null) throw new Error('no 3 × 3 Mat.create call')
  expect(call.slice(0, 3)).toEqual([3, 3, 6])
  const h = call[3] as number[]
  const apply = (p: { x: number; y: number }) => {
    const w = at(h, 6) * p.x + at(h, 7) * p.y + at(h, 8)
    return [(at(h, 0) * p.x + at(h, 1) * p.y + at(h, 2)) / w, (at(h, 3) * p.x + at(h, 4) * p.y + at(h, 5)) / w]
  }
  expect(apply(at(corners, 0))[0]).toBeCloseTo(-0.5, 6)
  expect(apply(at(corners, 0))[1]).toBeCloseTo(-0.5, 6)
  expect(apply(at(corners, 2))[0]).toBeCloseTo(3.5, 6)
  expect(apply(at(corners, 2))[1]).toBeCloseTo(3.5, 6)
})

it('releases every OpenCV object, also when the warp throws', () => {
  jest.mocked(OpenCV.warpPerspective).mockImplementationOnce(() => {
    throw new Error('warp failed')
  })
  expect(() =>
    warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4),
  ).toThrow('warp failed')
  expect(created.length).toBeGreaterThan(0)
  for (const object of created) expect(object.release).toHaveBeenCalledTimes(1)
})
