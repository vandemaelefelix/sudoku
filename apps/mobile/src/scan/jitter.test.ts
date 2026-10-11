import type { Quad } from '../scanner'
import { EMPTY_JITTER, type JitterReport, type JitterWindow, trackJitter } from './jitter'

function at(x: number): Quad {
  return [
    { x, y: 100 },
    { x: x + 200, y: 100 },
    { x: x + 200, y: 300 },
    { x, y: 300 },
  ]
}

function feed(inputs: Array<[Quad | null, number]>): JitterReport[] {
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
    const inputs = Array.from({ length: 151 }, (_, i): [Quad, number] => [at(100 + (i === 70 ? 1.5 : 0)), i / 30])
    const reports = feed(inputs)
    expect(reports).toHaveLength(1)
    expect(reports[0].maxStep).toBeCloseTo(1.5, 10)
    expect(reports[0].frames).toBe(150)
    expect(reports[0].seconds).toBeCloseTo(5, 10)
  })

  it('starts again when the outline disappears', () => {
    const before = Array.from({ length: 100 }, (_, i): [Quad, number] => [at(100), i / 30])
    const after = Array.from({ length: 151 }, (_, i): [Quad, number] => [at(100), 4 + i / 30])
    const reports = feed([...before, [null, 3.5], ...after])
    expect(reports).toHaveLength(1)
    expect(reports[0].seconds).toBeCloseTo(5, 10)
    expect(reports[0].frames).toBe(150)
  })

  it('starts again after a pause, so the step over the pause is not measured', () => {
    const before = Array.from({ length: 10 }, (_, i): [Quad, number] => [at(100), i / 30])
    const after = Array.from({ length: 151 }, (_, i): [Quad, number] => [at(240), 40 + i / 30])
    const reports = feed([...before, ...after])
    expect(reports).toHaveLength(1)
    expect(reports[0].maxStep).toBe(0)
    expect(reports[0].frames).toBe(150)
  })

  it('starts again when the clock goes back', () => {
    const before = Array.from({ length: 100 }, (_, i): [Quad, number] => [at(100), 10 + i / 30])
    const after = Array.from({ length: 151 }, (_, i): [Quad, number] => [at(100), 1 + i / 30])
    const reports = feed([...before, ...after])
    expect(reports).toHaveLength(1)
    expect(reports[0].seconds).toBeCloseTo(5, 10)
    expect(reports[0].frames).toBe(150)
  })
})
