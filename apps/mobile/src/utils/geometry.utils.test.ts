import { lerpQuad, type Quad, rectQuad } from './geometry.utils'

const trapezoid: Quad = [
  { x: 120, y: 80 },
  { x: 300, y: 100 },
  { x: 340, y: 360 },
  { x: 90, y: 330 },
]
const board: Quad = [
  { x: 16, y: 134 },
  { x: 386, y: 134 },
  { x: 386, y: 504 },
  { x: 16, y: 504 },
]

describe('lerpQuad', () => {
  it('returns the ends and the middle', () => {
    expect(lerpQuad(trapezoid, board, 0)).toEqual(trapezoid)
    expect(lerpQuad(trapezoid, board, 1)).toEqual(board)
    const mid = lerpQuad(trapezoid, board, 0.5)
    expect(mid[0]).toEqual({ x: 68, y: 107 })
    expect(mid[2]).toEqual({ x: 363, y: 432 })
  })
})

describe('rectQuad', () => {
  it('lists the corners clockwise from the top left', () => {
    expect(rectQuad({ x: 16, y: 134, width: 370, height: 370 })).toEqual(board)
  })
})
