import {
  type Smoothing,
  smoothQuad,
  EMPTY_JITTER,
  type JitterReport,
  type JitterWindow,
  trackJitter,
  countFrame,
  EMPTY_WINDOW,
  type FrameWindow,
} from './tracking.utils'
import type { Quad } from '@/utils/geometry.utils'
import { HOLD } from '@/scan/constants/tracking.constants'

const FRAME = 1 / 30

function smoothingQuad(x: number): Quad {
  return [
    { x, y: 0.3 },
    { x: x + 0.4, y: 0.3 },
    { x: x + 0.4, y: 0.6 },
    { x, y: 0.6 },
  ]
}

function run(inputs: Array<Quad | null>, start = 10): Array<Smoothing | null> {
  let state: Smoothing | null = null
  return inputs.map((quad, i) => {
    state = smoothQuad(state, quad, start + i * FRAME)
    return state
  })
}

describe('smoothQuad', () => {
  it('shows the first detection as it is', () => {
    expect(run([smoothingQuad(0.2)])[0]!.quad).toEqual(smoothingQuad(0.2))
  })

  it('keeps a still but noisy outline steady', () => {
    const inputs = Array.from({ length: 150 }, (_, i) => smoothingQuad(0.2 + (i % 2 === 0 ? 0.004 : -0.004)))
    const xs = run(inputs).map((state) => state!.quad[0].x)
    const steps = xs.slice(31).map((x, i) => Math.abs(x - (xs[30 + i] ?? Number.NaN)))
    expect(Math.max(...steps)).toBeLessThan(0.002)
  })

  it('follows a moving grid closely', () => {
    const inputs = Array.from({ length: 16 }, (_, i) => smoothingQuad(0.2 + 0.6 * i * FRAME))
    const last = run(inputs)[15]!
    expect(Math.abs(last.quad[0].x - (0.2 + 0.6 * 15 * FRAME))).toBeLessThan(0.015)
  })

  it('catches up within 100 ms after a jump', () => {
    const inputs = [
      ...Array.from({ length: 10 }, () => smoothingQuad(0.3)),
      smoothingQuad(0.4),
      smoothingQuad(0.4),
      smoothingQuad(0.4),
    ]
    expect(Math.abs(run(inputs)[12]!.quad[0].x - 0.4)).toBeLessThan(0.01)
  })

  it('holds the outline through a short gap', () => {
    const first = smoothQuad(null, smoothingQuad(0.2), 10)
    expect(smoothQuad(first, null, 10 + HOLD - 0.01)).toBe(first)
  })

  it('hides the outline after a longer gap', () => {
    const first = smoothQuad(null, smoothingQuad(0.2), 10)
    expect(smoothQuad(first, null, 10 + HOLD + 0.01)).toBeNull()
  })

  it('snaps to the grid when it comes back after a gap', () => {
    const first = smoothQuad(null, smoothingQuad(0.2), 10)
    expect(smoothQuad(first, smoothingQuad(0.5), 10 + HOLD + 0.01)!.quad).toEqual(smoothingQuad(0.5))
  })

  it('starts again when the clock goes back', () => {
    const first = smoothQuad(null, smoothingQuad(0.2), 10)
    expect(smoothQuad(first, smoothingQuad(0.5), 5)).toEqual({
      quad: smoothingQuad(0.5),
      velocity: expect.any(Array),
      timestamp: 5,
    })
  })
})

function jitterQuad(x: number): Quad {
  return [
    { x, y: 100 },
    { x: x + 200, y: 100 },
    { x: x + 200, y: 300 },
    { x, y: 300 },
  ]
}

function feedJitter(inputs: Array<[Quad | null, number]>): JitterReport[] {
  let window: JitterWindow = EMPTY_JITTER
  const reports: JitterReport[] = []
  for (const [quad, timestamp] of inputs) {
    const result = trackJitter(window, quad, timestamp)
    window = result.window
    if (result.report !== null) reports.push(result.report)
  }
  return reports
}

describe('trackJitter', () => {
  it('reports the largest corner step after 5 s of outline', () => {
    const inputs = Array.from({ length: 151 }, (_, i): [Quad, number] => [
      jitterQuad(100 + (i === 70 ? 1.5 : 0)),
      i / 30,
    ])
    const reports = feedJitter(inputs)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.maxStep).toBeCloseTo(1.5, 10)
    expect(reports[0]?.frames).toBe(150)
    expect(reports[0]?.seconds).toBeCloseTo(5, 10)
  })

  it('starts again when the outline disappears', () => {
    const before = Array.from({ length: 100 }, (_, i): [Quad, number] => [jitterQuad(100), i / 30])
    const after = Array.from({ length: 151 }, (_, i): [Quad, number] => [jitterQuad(100), 4 + i / 30])
    const reports = feedJitter([...before, [null, 3.5], ...after])
    expect(reports).toHaveLength(1)
    expect(reports[0]?.seconds).toBeCloseTo(5, 10)
    expect(reports[0]?.frames).toBe(150)
  })

  it('starts again after a pause, so the step over the pause is not measured', () => {
    const before = Array.from({ length: 10 }, (_, i): [Quad, number] => [jitterQuad(100), i / 30])
    const after = Array.from({ length: 151 }, (_, i): [Quad, number] => [jitterQuad(240), 40 + i / 30])
    const reports = feedJitter([...before, ...after])
    expect(reports).toHaveLength(1)
    expect(reports[0]?.maxStep).toBe(0)
    expect(reports[0]?.frames).toBe(150)
  })

  it('starts again when the clock goes back', () => {
    const before = Array.from({ length: 100 }, (_, i): [Quad, number] => [jitterQuad(100), 10 + i / 30])
    const after = Array.from({ length: 151 }, (_, i): [Quad, number] => [jitterQuad(100), 1 + i / 30])
    const reports = feedJitter([...before, ...after])
    expect(reports).toHaveLength(1)
    expect(reports[0]?.seconds).toBeCloseTo(5, 10)
    expect(reports[0]?.frames).toBe(150)
  })
})

function feedFrames(timestamps: number[], detectionMs = 0): Array<number | null> {
  let window: FrameWindow = EMPTY_WINDOW
  return timestamps.map((t) => {
    const result = countFrame(window, t, detectionMs)
    window = result.window
    return result.report?.fps ?? null
  })
}

describe('countFrame', () => {
  it('reports nothing for the first frame', () => {
    expect(feedFrames([10])).toEqual([null])
  })

  it('reports 30 fps after one second of frames at 30 fps', () => {
    const timestamps = Array.from({ length: 31 }, (_, i) => 10 + i / 30)
    const rates = feedFrames(timestamps)
    expect(rates.slice(0, 30).every((r) => r === null)).toBe(true)
    expect(rates[30]).toBeCloseTo(30, 5)
  })

  it('starts a new window after a report', () => {
    const timestamps = Array.from({ length: 61 }, (_, i) => i / 30)
    const rates = feedFrames(timestamps).filter((r) => r !== null)
    expect(rates).toHaveLength(2)
    expect(rates[1]).toBeCloseTo(30, 5)
  })

  it('restarts when the clock goes backwards', () => {
    const rates = feedFrames([5, 5.4, 2, 2.4, 2.8, 3.2])
    expect(rates.slice(0, 5)).toEqual([null, null, null, null, null])
    expect(rates[5]).toBeCloseTo(3 / 1.2, 5)
  })

  it('never reports a rate that is not finite', () => {
    const rates = feedFrames([1, 1, 1, 1.4, 1.8, 2.2])
    expect(rates.every((r) => r === null || Number.isFinite(r))).toBe(true)
    expect(rates[5]).toBeCloseTo(5 / 1.2, 5)
  })

  it('ignores the time while no frames arrive', () => {
    const before = Array.from({ length: 15 }, (_, i) => i / 30)
    const after = Array.from({ length: 31 }, (_, i) => 5 + i / 30)
    const rates = feedFrames([...before, ...after]).filter((r): r is number => r !== null)
    expect(rates.length).toBeGreaterThan(0)
    expect(rates.every((r) => r >= 29)).toBe(true)
    expect(Math.max(...rates)).toBeCloseTo(30, 0)
  })

  it('restarts after a gap longer than MAX_GAP', () => {
    const rates = feedFrames([0, 0.1, 0.7, 1.1, 1.5, 1.8])
    expect(rates.slice(0, 5)).toEqual([null, null, null, null, null])
    expect(rates[5]).toBeCloseTo(3 / 1.1, 5)
  })

  it('reports the mean detection time of the window', () => {
    let window: FrameWindow = EMPTY_WINDOW
    const reports = Array.from({ length: 31 }, (_, i) => {
      const result = countFrame(window, 10 + i / 30, i % 2 === 0 ? 4 : 8)
      window = result.window
      return result.report
    })
    expect(reports[30]!.detectionMs).toBeCloseTo(6, 1)
  })
})
