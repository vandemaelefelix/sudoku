import { wavePoints } from './geometry'

describe('wavePoints', () => {
  it('runs past both edges, so the line has no visible end', () => {
    const points = wavePoints(100, 10, 2, 40)
    expect(points[0]!.x).toBeLessThan(0)
    expect(points.at(-1)!.x).toBeGreaterThan(100)
  })

  it('stays within amp of the centre line', () => {
    for (const point of wavePoints(100, 10, 2, 40)) expect(Math.abs(point.y - 10)).toBeLessThanOrEqual(2)
  })
})
