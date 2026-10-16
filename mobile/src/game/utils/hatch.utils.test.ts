import { hatchLines } from './hatch.utils'

describe('hatchLines', () => {
  it('draws lines at 45°, so each one moves as far in x as in y', () => {
    for (const { x1, y1, x2, y2 } of hatchLines(40, 40, 5)) expect(Math.abs(x1 - x2)).toBe(Math.abs(y1 - y2))
  })

  it('spaces the lines by the pitch along the x axis', () => {
    const xs = hatchLines(40, 40, 5).map((line) => line.x1)
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBe(5)
  })

  it('covers the whole box: the first line reaches the top left corner and the last the bottom right', () => {
    const lines = hatchLines(40, 30, 5)
    expect(lines[0]).toEqual({ x1: 0, y1: 0, x2: -30, y2: 30 })
    expect(lines.at(-1)?.x2).toBeGreaterThanOrEqual(40 - 30)
    expect(lines.at(-1)?.x1).toBeGreaterThanOrEqual(40)
  })

  it('draws one line at x 0 for an empty box', () => {
    expect(hatchLines(0, 0, 5)).toHaveLength(1)
  })
})
