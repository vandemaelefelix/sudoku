import {
  advanceClock,
  type Channels,
  digitAlpha,
  GATE_PHOTO,
  GATE_RESULTS,
  panelAt,
  REDUCED_END,
  ringsAt,
  SPINNER_DELAY,
  TRANSITION_END,
  transitionAt,
  sweepShift,
  transitionEnd,
  photoToSkImage,
  photoMatrix,
} from './transition.utils'
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia'
import { toPreview } from './preview.utils'
import type { Point, Quad } from '@/utils/geometry.utils'

const open = { photo: true, results: true }
const smooth = (x: number) => x * x * (3 - 2 * x)
const ramp = (t: number, a: number, b: number) => smooth(Math.min(1, Math.max(0, (t - a) / (b - a))))

describe('constants', () => {
  it('match the timeline', () => {
    expect(TRANSITION_END).toBe(1.5)
    expect(REDUCED_END).toBe(0.3)
    expect(GATE_PHOTO).toBe(0.05)
    expect(GATE_RESULTS).toBe(0.7)
    expect(SPINNER_DELAY).toBe(1)
    expect(transitionEnd(false)).toBe(1.5)
    expect(transitionEnd(true)).toBe(0.3)
  })

  it('moves the end later by the shift, except with Reduce Motion', () => {
    expect(transitionEnd(false, 0.15)).toBeCloseTo(1.65, 12)
    expect(transitionEnd(true, 0.15)).toBe(0.3)
  })
})

describe('transitionAt', () => {
  it('starts with the flash up and everything else at rest', () => {
    const c = transitionAt(0, false)
    expect(c.flash).toBe(1)
    expect(c.pulse).toBe(0)
    expect(c.photo).toBe(1)
    for (const key of [
      'flatten',
      'freeDrift',
      'dim',
      'ink',
      'cells',
      'lines',
      'shrink',
      'title',
      'rings',
      'panel',
    ] as const) {
      expect(c[key]).toBe(0)
    }
  })

  it('has the flash gone and the pulse back at 0.25', () => {
    const c = transitionAt(0.25, false)
    expect(c.flash).toBe(0)
    expect(c.pulse).toBeCloseTo(0, 12)
    expect(transitionAt(0.125, false).pulse).toBeCloseTo(1, 12)
  })

  it('starts the flatten, the drift and the dim at 0.05', () => {
    const c = transitionAt(0.05, false)
    expect(c.flatten).toBe(0)
    expect(c.freeDrift).toBe(0)
    expect(c.dim).toBe(0)
    expect(c.ink).toBe(0)
  })

  it('matches the ramps at 0.5', () => {
    const c = transitionAt(0.5, false)
    expect(c.flatten).toBe(1)
    expect(c.dim).toBe(1)
    expect(c.freeDrift).toBe(1)
    expect(c.ink).toBe(1)
    expect(c.cells).toBeCloseTo(ramp(0.5, 0.3, 0.55), 12)
    expect(c.photo).toBe(1)
    expect(c.title).toBe(1)
    expect(c.lines).toBeCloseTo(ramp(0.5, 0.35, 0.7), 12)
  })

  it('has the lines done and the photo fading at 0.7', () => {
    const c = transitionAt(0.7, false)
    expect(c.lines).toBe(1)
    expect(c.photo).toBeCloseTo(1 - ramp(0.7, 0.5, 0.8), 12)
    expect(c.title).toBe(1)
    expect(c.shrink).toBeCloseTo(ramp(0.7, 0.65, 0.95), 12)
  })

  it('has the panel and rings still at rest at 1.0', () => {
    const c = transitionAt(1, false)
    expect(c.photo).toBe(0)
    expect(c.title).toBe(1)
    expect(c.shrink).toBe(1)
    expect(c.rings).toBe(0)
    expect(c.panel).toBe(0)
  })

  it('ends with every channel at its end value at 1.5', () => {
    const { pulse, ...c } = transitionAt(1.5, false)
    expect(pulse).toBeCloseTo(0, 12)
    expect(c).toEqual<Omit<Channels, 'pulse'>>({
      flash: 0,
      flatten: 1,
      freeDrift: 1,
      dim: 1,
      ink: 1,
      cells: 1,
      lines: 1,
      photo: 0,
      shrink: 1,
      title: 1,
      rings: 1,
      panel: 1,
    })
  })

  it('keeps every channel in 0..1 and clamps outside the range', () => {
    for (let t = -0.2; t <= 1.8; t += 0.01) {
      for (const value of Object.values(transitionAt(t, false))) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('fades the title in at 0.20 to 0.50', () => {
    expect(transitionAt(0.2, false).title).toBe(0)
    expect(transitionAt(0.35, false).title).toBeCloseTo(0.5, 12)
    expect(transitionAt(0.5, false).title).toBe(1)
  })

  it('moves the rings and the panel later by the shift, and nothing else', () => {
    const shifted = transitionAt(1.4, false, 0.1)
    expect(shifted.rings).toBeCloseTo(0.5, 12)
    expect(shifted.panel).toBeCloseTo(ramp(1.3, 1.2, 1.5), 12)
    const { rings, panel, ...rest } = shifted
    const { rings: _r, panel: _p, ...plain } = transitionAt(1.4, false)
    expect(rest).toEqual(plain)
    expect(rings).not.toBe(_r)
    expect(panel).not.toBe(_p)
  })

  it('moves the rings and the panel in their own windows', () => {
    expect(transitionAt(1.3, false).rings).toBeCloseTo(0.5, 12)
    expect(transitionAt(1.35, false).panel).toBeCloseTo(0.5, 12)
  })
})

describe('digitAlpha', () => {
  it('starts cell (0, 0) at 0.55 and ends it 0.15 s later', () => {
    expect(digitAlpha(0.55, 0, 0, false)).toBe(0)
    expect(digitAlpha(0.7, 0, 0, false)).toBe(1)
    expect(digitAlpha(0.625, 0, 0, false)).toBeCloseTo(0.5, 12)
  })

  it('delays each cell by 28 ms per row plus column', () => {
    expect(digitAlpha(0.55 + 0.028 * 3, 1, 2, false)).toBe(0)
    expect(digitAlpha(0.55 + 0.028 * 3 + 0.15, 1, 2, false)).toBe(1)
  })

  it('ends cell (8, 8) before 1.2', () => {
    expect(digitAlpha(1.2, 8, 8, false)).toBe(1)
    expect(digitAlpha(0.55 + 0.028 * 16, 8, 8, false)).toBe(0)
  })

  it('starts the sweep later by the shift', () => {
    expect(digitAlpha(0.65, 0, 0, false, 0.1)).toBe(0)
    expect(digitAlpha(0.725, 0, 0, false, 0.1)).toBeCloseTo(0.5, 12)
    expect(digitAlpha(1.3, 8, 8, false, 0.1)).toBe(1)
  })

  it('ignores the shift with Reduce Motion', () => {
    expect(digitAlpha(0.15, 3, 4, true, 0.1)).toBeCloseTo(0.5, 12)
  })

  it('follows one fade with Reduce Motion', () => {
    expect(digitAlpha(0, 8, 8, true)).toBe(0)
    expect(digitAlpha(0.15, 3, 4, true)).toBeCloseTo(0.5, 12)
    expect(digitAlpha(0.3, 8, 8, true)).toBe(1)
  })
})

describe('ringsAt and panelAt', () => {
  it('match the channels of transitionAt', () => {
    for (const reduceMotion of [false, true]) {
      for (let t = 0; t <= 1.7; t += 0.05) {
        const c = transitionAt(t, reduceMotion, 0.1)
        expect(ringsAt(t, reduceMotion, 0.1)).toBe(c.rings)
        expect(panelAt(t, reduceMotion, 0.1)).toBe(c.panel)
      }
    }
  })
})

describe('sweepShift', () => {
  it('is 0 when the results came before the sweep start', () => {
    expect(sweepShift(0.3, 1, false)).toBe(0)
    expect(sweepShift(0.55, 1, false)).toBe(0)
  })

  it('is the delay of the results after the sweep start', () => {
    expect(sweepShift(GATE_RESULTS, 1, false)).toBeCloseTo(0.15, 12)
    expect(sweepShift(0.6, 1, false)).toBeCloseTo(0.05, 12)
  })

  it('takes the clock as the arrival time while the arrival is not known (resultsAt below 0)', () => {
    expect(sweepShift(-1, 0.65, false)).toBeCloseTo(0.1, 12)
    expect(sweepShift(-1, 0.4, false)).toBe(0)
  })

  it('is 0 with Reduce Motion', () => {
    expect(sweepShift(GATE_RESULTS, 1, true)).toBe(0)
  })
})

describe('Reduce Motion', () => {
  it('fades once over 0.3 s', () => {
    const c = transitionAt(0.15, true)
    const f = ramp(0.15, 0, 0.3)
    expect(f).toBeCloseTo(0.5, 12)
    expect(c.flatten).toBe(1)
    expect(c.photo).toBeCloseTo(1 - f, 12)
    for (const key of ['dim', 'cells', 'lines', 'title', 'rings', 'panel', 'ink', 'shrink', 'freeDrift'] as const) {
      expect(c[key]).toBeCloseTo(f, 12)
    }
    expect(c.flash).toBe(0)
    expect(c.pulse).toBe(0)
  })

  it('starts at the frozen view and ends at the correction screen', () => {
    const start = transitionAt(0, true)
    expect(start.photo).toBe(1)
    expect(start.panel).toBe(0)
    const end = transitionAt(0.3, true)
    expect(end.photo).toBe(0)
    expect(end.panel).toBe(1)
    expect(end.cells).toBe(1)
  })
})

describe('advanceClock', () => {
  it('adds dt when the gates are open', () => {
    expect(advanceClock(0.2, 0.016, open, false)).toBeCloseTo(0.216, 12)
  })

  it('holds at 0.05 without the photo', () => {
    const gates = { photo: false, results: false }
    expect(advanceClock(0.04, 0.016, gates, false)).toBe(GATE_PHOTO)
    expect(advanceClock(GATE_PHOTO, 0.016, gates, false)).toBe(GATE_PHOTO)
  })

  it('passes the photo gate once the photo is ready and holds at 0.7 without the results', () => {
    const gates = { photo: true, results: false }
    expect(advanceClock(GATE_PHOTO, 0.1, gates, false)).toBeCloseTo(0.15, 12)
    expect(advanceClock(0.69, 0.1, gates, false)).toBe(GATE_RESULTS)
    expect(advanceClock(GATE_RESULTS, 0.1, gates, false)).toBe(GATE_RESULTS)
  })

  it('holds where it is when both gates are closed at 0.3 in the cross-fade', () => {
    expect(advanceClock(0.3, 0.1, { photo: false, results: false }, true)).toBe(0.3)
  })

  it('holds a closed results gate where the clock is in the cross-fade', () => {
    expect(advanceClock(GATE_PHOTO, 0.1, { photo: true, results: false }, true)).toBe(GATE_PHOTO)
    expect(advanceClock(0.2, 0.1, { photo: true, results: false }, true)).toBe(0.2)
  })

  it('ends later by the shift', () => {
    expect(advanceClock(1.49, 0.1, open, false, 0.15)).toBeCloseTo(1.59, 12)
    expect(advanceClock(1.6, 0.1, open, false, 0.15)).toBeCloseTo(1.65, 12)
  })

  it('does not go back on a negative dt', () => {
    expect(advanceClock(0.2, -0.1, open, false)).toBe(0.2)
  })

  it('does not hold at 0.7 for a photo gate that is closed earlier', () => {
    expect(advanceClock(0.3, 0.1, { photo: false, results: true }, false)).toBeCloseTo(0.4, 12)
  })

  it('never goes past the end', () => {
    expect(advanceClock(1.49, 0.1, open, false)).toBe(TRANSITION_END)
    expect(advanceClock(1.5, 0.1, open, false)).toBe(TRANSITION_END)
    expect(advanceClock(0.25, 0.1, open, true)).toBe(REDUCED_END)
  })

  it('puts both gates at 0 with Reduce Motion', () => {
    expect(advanceClock(0, 0.1, { photo: false, results: true }, true)).toBe(0)
    expect(advanceClock(0, 0.1, { photo: true, results: false }, true)).toBe(0)
    expect(advanceClock(0, 0.1, open, true)).toBeCloseTo(0.1, 12)
  })
})

function setup(pixelFormat: string, size = { width: 2376, height: 4224 }, rowBytes = 900 * 4) {
  const buffer = new ArrayBuffer(rowBytes * 1600)
  const small = {
    dispose: jest.fn(),
    toRawPixelDataAsync: jest.fn(async () => ({ buffer, width: 900, height: 1600, pixelFormat })),
  }
  const full = { ...size, dispose: jest.fn(), resizeAsync: jest.fn(async () => small) }
  const photo = { toImageAsync: jest.fn(async () => full) }
  return { photo: photo as never, full, small }
}

beforeEach(() => jest.clearAllMocks())

it('resizes to the long side before it reads the pixels, and builds a Skia image', async () => {
  const { photo, full } = setup('BGRA')
  const image = await photoToSkImage(photo, 1600)
  expect(full.resizeAsync).toHaveBeenCalledWith(900, 1600)
  expect(Skia.Image.MakeImage).toHaveBeenCalledWith(
    { width: 900, height: 1600, colorType: ColorType.BGRA_8888, alphaType: AlphaType.Premul },
    expect.anything(),
    3600,
  )
  expect(image).toBe(jest.mocked(Skia.Image.MakeImage).mock.results[0]!.value)
})

it('reads the row bytes from the buffer, because a resize can pad the rows', async () => {
  const { photo } = setup('BGRA', undefined, 3648)
  await photoToSkImage(photo, 1600)
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![2]).toBe(3648)
})

it.each([
  ['shorter than a row', 900 * 4 - 4],
  ['not a whole number per row', 900 * 4 + 0.5],
])('throws and disposes when the buffer is %s', async (_name, rowBytes) => {
  const { photo, full, small } = setup('BGRA', undefined, rowBytes)
  await expect(photoToSkImage(photo, 1600)).rejects.toThrow('row')
  expect(full.dispose).toHaveBeenCalledTimes(1)
  expect(small.dispose).toHaveBeenCalledTimes(1)
})

it.each([
  ['BGRA', AlphaType.Premul],
  ['BGRX', AlphaType.Opaque],
  ['RGBA', AlphaType.Premul],
  ['RGBX', AlphaType.Opaque],
])('picks the alpha type from the pixel format %s', async (pixelFormat, alphaType) => {
  const { photo } = setup(pixelFormat)
  await photoToSkImage(photo, 1600)
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![0]).toMatchObject({ alphaType })
})

it('disposes the pixel data once Skia made the image, and also when it could not', async () => {
  const { photo } = setup('BGRA')
  await photoToSkImage(photo, 1600)
  const data = jest.mocked(Skia.Data.fromBytes).mock.results[0]!.value
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![1]).toBe(data)
  expect(data.dispose).toHaveBeenCalledTimes(1)
  jest.mocked(Skia.Image.MakeImage).mockReturnValueOnce(null)
  await expect(photoToSkImage(setup('BGRA').photo, 1600)).rejects.toThrow('Skia')
  expect(jest.mocked(Skia.Data.fromBytes).mock.results[1]!.value.dispose).toHaveBeenCalledTimes(1)
})

it('does not enlarge a small photo', async () => {
  const { photo, full } = setup('BGRA', { width: 800, height: 600 })
  await photoToSkImage(photo, 1600)
  expect(full.resizeAsync).toHaveBeenCalledWith(800, 600)
})

it.each([
  ['BGRA', ColorType.BGRA_8888],
  ['BGRX', ColorType.BGRA_8888],
  ['RGBA', ColorType.RGBA_8888],
  ['RGBX', ColorType.RGBA_8888],
])('picks the colour type from the pixel format %s', async (pixelFormat, colorType) => {
  const { photo } = setup(pixelFormat)
  await photoToSkImage(photo, 1600)
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![0]).toMatchObject({ colorType })
})

it('disposes both nitro images', async () => {
  const { photo, full, small } = setup('BGRA')
  await photoToSkImage(photo, 1600)
  expect(full.dispose).toHaveBeenCalledTimes(1)
  expect(small.dispose).toHaveBeenCalledTimes(1)
})

it('throws on another pixel format and still disposes', async () => {
  const { photo, full, small } = setup('RGB')
  await expect(photoToSkImage(photo, 1600)).rejects.toThrow('pixel format RGB')
  expect(full.dispose).toHaveBeenCalledTimes(1)
  expect(small.dispose).toHaveBeenCalledTimes(1)
})

it('throws when Skia returns no image', async () => {
  const { photo } = setup('BGRA')
  jest.mocked(Skia.Image.MakeImage).mockReturnValueOnce(null)
  await expect(photoToSkImage(photo, 1600)).rejects.toThrow('Skia could not make an image')
})

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
