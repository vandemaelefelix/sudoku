import { Mat } from 'react-native-fast-opencv'
import { findGrid, findGrids } from './findGrid'

type Pt = { x: number; y: number }

// A fake fast-opencv. It records every object it creates, so the tests can check release().
jest.mock('react-native-fast-opencv', () => {
  class Tracked {
    released = false
    constructor() {
      mockCreated.push(this)
    }
    release() {
      this.released = true
    }
  }
  class FakePoint extends Tracked {
    x: number
    y: number
    constructor(x: number, y: number) {
      super()
      this.x = x
      this.y = y
    }
  }
  class FakePointVector extends Tracked {
    points: Pt[]
    constructor(points: Pt[] = []) {
      super()
      this.points = points
    }
    get length() {
      return this.points.length
    }
    get(index: number) {
      const point = this.points[index]
      if (point === undefined) throw new RangeError(`no point at index ${index}`)
      return new FakePoint(point.x, point.y)
    }
  }
  class FakeContours extends Tracked {
    items: Pt[][] = []
    get length() {
      return this.items.length
    }
    get(index: number) {
      return new FakePointVector(this.items[index])
    }
  }
  return {
    AdaptiveThresholdTypes: { ADAPTIVE_THRESH_GAUSSIAN_C: 1 },
    ColorConversionCodes: { COLOR_RGB2GRAY: 7 },
    ContourApproximationModes: { CHAIN_APPROX_SIMPLE: 2 },
    DataTypes: { CV_8U: 0 },
    RetrievalModes: { RETR_EXTERNAL: 0 },
    ThresholdTypes: { THRESH_BINARY_INV: 1 },
    Mat: {
      create: jest.fn(() => new Tracked()),
      createFromBuffer: jest.fn(() => new Tracked()),
    },
    Size: { create: () => new Tracked() },
    PointVector: { create: () => new FakePointVector() },
    PointVectorOfVectors: { create: () => new FakeContours() },
    OpenCV: {
      cvtColor: () => mockStep('cvtColor'),
      GaussianBlur: () => mockStep('GaussianBlur'),
      adaptiveThreshold: () => mockStep('adaptiveThreshold'),
      findContours: (_image: unknown, contours: FakeContours) => {
        mockStep('findContours')
        contours.items = mockContours
      },
      contourArea: (contour: FakePointVector) => ({ value: mockArea(contour.points) }),
      arcLength: (contour: FakePointVector) => ({ value: mockPerimeter(contour.points) }),
      approxPolyDP: (contour: FakePointVector, corners: FakePointVector) => {
        corners.points = contour.points
      },
    },
  }
})

const mockCreated: { released: boolean }[] = []
let mockContours: Pt[][] = []
let mockFailure: string | null = null

function mockArea(points: Pt[]) {
  return (
    Math.abs(
      points.reduce((sum, a, i) => {
        const b = points[(i + 1) % points.length]
        if (b === undefined) throw new RangeError('the contour has no next point')
        return sum + a.x * b.y - b.x * a.y
      }, 0),
    ) / 2
  )
}

function mockPerimeter(points: Pt[]) {
  return points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]
    if (b === undefined) throw new RangeError('the contour has no next point')
    return sum + Math.hypot(b.x - a.x, b.y - a.y)
  }, 0)
}

function mockStep(name: string) {
  if (mockFailure === name) throw new Error(`${name} failed`)
}

const width = 360
const height = 640
const pixels = new Uint8Array(width * height * 3)

function rect(left: number, top: number, right: number, bottom: number): Pt[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ]
}

beforeEach(() => {
  mockCreated.length = 0
  mockContours = []
  mockFailure = null
})

describe('findGrid', () => {
  it('returns the normalised quad of a large square contour', () => {
    mockContours = [rect(72, 128, 288, 512)]
    const detection = findGrid(pixels, width, height)
    expect(detection).not.toBeNull()
    expect(detection!.quad[0].x).toBeCloseTo(72.5 / width, 10)
    expect(detection!.quad[0].y).toBeCloseTo(128.5 / height, 10)
    expect(detection!.quad[2].x).toBeCloseTo(288.5 / width, 10)
    expect(detection!.quad[2].y).toBeCloseTo(512.5 / height, 10)
    expect(detection!.score).toBeCloseTo(0.36, 2)
  })

  it('reads the pixels as a height × width RGB image', () => {
    findGrid(pixels, width, height)
    expect(Mat.createFromBuffer).toHaveBeenCalledWith('uint8', height, width, 3, pixels)
  })

  it('picks the largest four-corner contour', () => {
    mockContours = [rect(100, 200, 260, 400), rect(40, 100, 320, 540)]
    expect(findGrid(pixels, width, height)!.quad[0].x).toBeCloseTo(40.5 / width, 10)
  })

  it('skips a larger contour that does not have four corners', () => {
    const pentagon = [
      { x: 20, y: 60 },
      { x: 340, y: 60 },
      { x: 340, y: 600 },
      { x: 180, y: 620 },
      { x: 20, y: 600 },
    ]
    mockContours = [pentagon, rect(72, 128, 288, 512)]
    expect(findGrid(pixels, width, height)!.quad[0].x).toBeCloseTo(72.5 / width, 10)
  })

  it('ignores contours smaller than a tenth of the frame', () => {
    mockContours = [rect(100, 200, 200, 300)]
    expect(findGrid(pixels, width, height)).toBeNull()
  })

  it('returns null when the frame has no contours', () => {
    expect(findGrid(pixels, width, height)).toBeNull()
  })

  it('releases every OpenCV object after a detection', () => {
    mockContours = [rect(100, 200, 200, 300), rect(72, 128, 288, 512)]
    findGrid(pixels, width, height)
    expect(mockCreated.length).toBeGreaterThan(5)
    expect(mockCreated.every((object) => object.released)).toBe(true)
  })

  it('releases every OpenCV object when no grid is found', () => {
    mockContours = [rect(100, 200, 200, 300)]
    findGrid(pixels, width, height)
    expect(mockCreated.every((object) => object.released)).toBe(true)
  })

  it.each(['cvtColor', 'adaptiveThreshold', 'findContours'])('releases every OpenCV object when %s fails', (name) => {
    mockContours = [rect(72, 128, 288, 512)]
    mockFailure = name
    expect(() => findGrid(pixels, width, height)).toThrow(`${name} failed`)
    expect(mockCreated.length).toBeGreaterThan(0)
    expect(mockCreated.every((object) => object.released)).toBe(true)
  })
})

describe('findGrids', () => {
  it('returns every plausible grid, the largest first', () => {
    mockContours = [rect(100, 200, 260, 400), rect(100, 200, 200, 300), rect(40, 100, 320, 540)]
    const detections = findGrids(pixels, width, height)
    expect(detections.map((detection) => detection.quad[0].x)).toEqual([40.5 / width, 100.5 / width])
  })

  it('returns an empty list when the frame has no grid', () => {
    expect(findGrids(pixels, width, height)).toEqual([])
  })
})
