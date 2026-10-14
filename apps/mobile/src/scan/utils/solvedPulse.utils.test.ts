import { CENTRE_CELL, solvedDelays } from './solvedPulse.utils'

describe('solvedDelays', () => {
  it('starts at the centre cell and adds one step for each cell of distance', () => {
    const delays = solvedDelays(45)
    expect(delays).toHaveLength(81)
    expect(delays[CENTRE_CELL]).toBe(0)
    expect(delays[CENTRE_CELL + 1]).toBe(45)
    expect(delays[CENTRE_CELL + 9]).toBe(45)
    expect(delays[0]).toBe(8 * 45)
    expect(delays[80]).toBe(8 * 45)
  })
})
