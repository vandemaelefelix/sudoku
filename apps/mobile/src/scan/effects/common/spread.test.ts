import { spreadStep } from './spread'

describe('spreadStep', () => {
  it('pushes two close points apart along the line between them', () => {
    const next = spreadStep([{ x: 0, y: 0 }, { x: 10, y: 0 }], [true, true], 20, 2)
    expect(next[0]).toEqual({ x: -1, y: 0 })
    expect(next[1]).toEqual({ x: 11, y: 0 })
  })

  it('leaves points that are further apart than the radius', () => {
    const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }]
    expect(spreadStep(points, [true, true], 20, 2)).toEqual(points)
  })

  it('does not move a fixed point, but it still pushes', () => {
    const next = spreadStep([{ x: 0, y: 0 }, { x: 10, y: 0 }], [false, true], 20, 2)
    expect(next[0]).toEqual({ x: 0, y: 0 })
    expect(next[1]).toEqual({ x: 11, y: 0 })
  })

  it('does not change its input', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    spreadStep(points, [true, true], 20, 2)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }])
  })

  it('ignores two points on the same spot', () => {
    const next = spreadStep([{ x: 5, y: 5 }, { x: 5, y: 5 }], [true, true], 20, 2)
    expect(next).toEqual([{ x: 5, y: 5 }, { x: 5, y: 5 }])
  })
})
