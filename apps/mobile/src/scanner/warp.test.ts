import { Mat, OpenCV, Point2f } from 'react-native-fast-opencv'
import { warpGrid } from './warp'

type Fake = { release: jest.Mock }
const created: Fake[] = []
function mockFake<T extends object>(extra: T): T & Fake {
  const object = { ...extra, release: jest.fn() }
  created.push(object)
  return object
}

jest.mock('react-native-fast-opencv', () => ({
  BorderTypes: { BORDER_REPLICATE: 1 },
  DataTypes: { CV_8U: 0 },
  DecompTypes: { DECOMP_LU: 0 },
  InterpolationFlags: { INTER_LINEAR: 1 },
  Mat: {
    createFromBuffer: jest.fn((_type: string, rows: number, cols: number) => mockFake({ rows, cols })),
    create: jest.fn(() => mockFake({ toBuffer: () => ({ buffer: new Uint8Array(4 * 4 * 4).fill(7) }) })),
  },
  Point2f: { create: jest.fn((x: number, y: number) => mockFake({ x, y })) },
  Point2fVector: { create: jest.fn(() => mockFake({})) },
  Size: { create: jest.fn(() => mockFake({})) },
  Scalar: { create: jest.fn(() => mockFake({})) },
  OpenCV: { getPerspectiveTransform: jest.fn(() => mockFake({})), warpPerspective: jest.fn() },
}))

const corners = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
]

beforeEach(() => {
  created.length = 0
  jest.clearAllMocks()
})

it('returns side × side pixels in the source format', () => {
  const out = warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  expect(out).toMatchObject({ width: 4, height: 4, pixelFormat: 'BGRA' })
  expect(new Uint8Array(out.buffer)).toHaveLength(64)
  expect(new Uint8Array(out.buffer)[0]).toBe(7)
})

it('reads a padded row as extra columns', () => {
  warpGrid({ buffer: new ArrayBuffer(100 * 104 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  expect(jest.mocked(Mat.createFromBuffer).mock.calls[0].slice(1, 4)).toEqual([100, 104, 4])
})

it('maps the corners to the edges of the square', () => {
  warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  const points = jest.mocked(Point2f.create).mock.calls
  expect(points.slice(0, 4)).toEqual([[10, 10], [90, 10], [90, 90], [10, 90]])
  expect(points.slice(4)).toEqual([[-0.5, -0.5], [3.5, -0.5], [3.5, 3.5], [-0.5, 3.5]])
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
