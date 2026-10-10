import { countFrame, EMPTY_WINDOW, type FrameWindow } from './frameRate'

function feed(timestamps: number[], detectionMs = 0): Array<number | null> {
  let window: FrameWindow = EMPTY_WINDOW
  return timestamps.map((t) => {
    const result = countFrame(window, t, detectionMs)
    window = result.window
    return result.report?.fps ?? null
  })
}

describe('countFrame', () => {
  it('reports nothing for the first frame', () => {
    expect(feed([10])).toEqual([null])
  })

  it('reports 30 fps after one second of frames at 30 fps', () => {
    const timestamps = Array.from({ length: 31 }, (_, i) => 10 + i / 30)
    const rates = feed(timestamps)
    expect(rates.slice(0, 30).every((r) => r === null)).toBe(true)
    expect(rates[30]).toBeCloseTo(30, 5)
  })

  it('starts a new window after a report', () => {
    const timestamps = Array.from({ length: 61 }, (_, i) => i / 30)
    const rates = feed(timestamps).filter((r) => r !== null)
    expect(rates).toHaveLength(2)
    expect(rates[1]).toBeCloseTo(30, 5)
  })

  it('restarts when the clock goes backwards', () => {
    const rates = feed([5, 5.4, 2, 2.4, 2.8, 3.2])
    expect(rates.slice(0, 5)).toEqual([null, null, null, null, null])
    expect(rates[5]).toBeCloseTo(3 / 1.2, 5)
  })

  it('never reports a rate that is not finite', () => {
    const rates = feed([1, 1, 1, 1.4, 1.8, 2.2])
    expect(rates.every((r) => r === null || Number.isFinite(r))).toBe(true)
    expect(rates[5]).toBeCloseTo(5 / 1.2, 5)
  })

  it('ignores the time while no frames arrive', () => {
    const before = Array.from({ length: 15 }, (_, i) => i / 30)
    const after = Array.from({ length: 31 }, (_, i) => 5 + i / 30)
    const rates = feed([...before, ...after]).filter((r): r is number => r !== null)
    expect(rates.length).toBeGreaterThan(0)
    expect(rates.every((r) => r >= 29)).toBe(true)
    expect(Math.max(...rates)).toBeCloseTo(30, 0)
  })

  it('restarts after a gap longer than MAX_GAP', () => {
    const rates = feed([0, 0.1, 0.7, 1.1, 1.5, 1.8])
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
