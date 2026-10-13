import type { Quad } from '@/utils/geometry.utils'
import { fitRect, projectGrid, quadInRect } from './inspector.utils'

const unit: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

describe('fitRect', () => {
  it('draws a portrait photo as large as it fits and centres it', () => {
    expect(fitRect(300, 400, { x: 10, y: 20, width: 600, height: 400 })).toEqual({
      x: 160,
      y: 20,
      width: 300,
      height: 400,
    })
  })
})

describe('quadInRect', () => {
  it('maps a normalised quad into the rect of the drawn photo', () => {
    const quad = quadInRect(unit, { x: 10, y: 20, width: 100, height: 200 })
    expect(quad[0]).toEqual({ x: 10, y: 20 })
    expect(quad[2]).toEqual({ x: 110, y: 220 })
  })
})

describe('projectGrid', () => {
  it('gives 20 grid lines and 81 cell centres, with straight lines for the unit square', () => {
    const grid = projectGrid(unit)!
    expect(grid.lines).toHaveLength(20)
    expect(grid.centres).toHaveLength(81)
    expect(grid.centres[0]!.x).toBeCloseTo(1 / 18)
    expect(grid.centres[80]!.y).toBeCloseTo(17 / 18)
    expect(grid.lines[2]!.from.x).toBeCloseTo(1 / 9)
  })

  it('is null for a quad that cannot carry a grid', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]
    expect(projectGrid(flat)).toBeNull()
  })
})
