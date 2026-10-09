import { countFrame, EMPTY_WINDOW, type FrameWindow } from './frameRate'

function feed(timestamps: number[]): Array<number | null> {
  let window: FrameWindow = EMPTY_WINDOW
  return timestamps.map((t) => {
    const result = countFrame(window, t)
    window = result.window
    return result.fps
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
    expect(feed([5, 5.5, 2, 2.5])).toEqual([null, null, null, null])
  })

  it('never reports a rate that is not finite', () => {
    const rates = feed([1, 1, 1, 2.5])
    expect(rates.every((r) => r === null || Number.isFinite(r))).toBe(true)
    expect(rates[3]).toBeCloseTo(3 / 1.5, 5)
  })
})
