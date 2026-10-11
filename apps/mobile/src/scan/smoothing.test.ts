import type { Quad } from '../scanner'
import { HOLD, type Smoothing, smoothQuad } from './smoothing'

const FRAME = 1 / 30

function at(x: number): Quad {
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
    expect(run([at(0.2)])[0]!.quad).toEqual(at(0.2))
  })

  it('keeps a still but noisy outline steady', () => {
    const inputs = Array.from({ length: 150 }, (_, i) => at(0.2 + (i % 2 === 0 ? 0.004 : -0.004)))
    const xs = run(inputs).map((state) => state!.quad[0].x)
    const steps = xs.slice(31).map((x, i) => Math.abs(x - xs[30 + i]))
    expect(Math.max(...steps)).toBeLessThan(0.002)
  })

  it('follows a moving grid closely', () => {
    const inputs = Array.from({ length: 16 }, (_, i) => at(0.2 + 0.6 * i * FRAME))
    const last = run(inputs)[15]!
    expect(Math.abs(last.quad[0].x - (0.2 + 0.6 * 15 * FRAME))).toBeLessThan(0.015)
  })

  it('catches up within 100 ms after a jump', () => {
    const inputs = [...Array.from({ length: 10 }, () => at(0.3)), at(0.4), at(0.4), at(0.4)]
    expect(Math.abs(run(inputs)[12]!.quad[0].x - 0.4)).toBeLessThan(0.01)
  })

  it('holds the outline through a short gap', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, null, 10 + HOLD - 0.01)).toBe(first)
  })

  it('hides the outline after a longer gap', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, null, 10 + HOLD + 0.01)).toBeNull()
  })

  it('snaps to the grid when it comes back after a gap', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, at(0.5), 10 + HOLD + 0.01)!.quad).toEqual(at(0.5))
  })

  it('starts again when the clock goes back', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, at(0.5), 5)).toEqual({ quad: at(0.5), velocity: expect.any(Array), timestamp: 5 })
  })
})
