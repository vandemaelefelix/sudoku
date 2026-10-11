import { createScene, stepScene } from '@/scan/effects/scene'
import { gridInverse, IDENTITY, prototypePixel, prototypeScale, toColumnMajor } from './shaderMatrix'
import type { Quad } from '@/utils/geometry.utils'
import { invert, project, unitToQuad } from '@/utils/homography.utils'

const skewed: Quad = [
  { x: 100, y: 200 },
  { x: 300, y: 190 },
  { x: 330, y: 420 },
  { x: 80, y: 400 },
]

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}

describe('toColumnMajor', () => {
  it('gives the 9 floats of a float3x3 uniform, column by column, with 1 at the end', () => {
    const m = unitToQuad(skewed)!
    const c = toColumnMajor(m)
    expect(c).toHaveLength(9)
    expect(c[8]).toBe(1)
    const u = 0.3
    const v = 0.7
    const w = itemAt(c, 2) * u + itemAt(c, 5) * v + itemAt(c, 8)
    const p = project(m, u, v)
    expect((itemAt(c, 0) * u + itemAt(c, 3) * v + itemAt(c, 6)) / w).toBeCloseTo(p.x, 6)
    expect((itemAt(c, 1) * u + itemAt(c, 4) * v + itemAt(c, 7)) / w).toBeCloseTo(p.y, 6)
  })

  it('keeps the identity', () => {
    expect(toColumnMajor(IDENTITY)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})

describe('prototype units', () => {
  it('scales the 220 pt prototype phone to the view, at pixel density 2', () => {
    expect(prototypeScale(440)).toBe(2)
    expect(prototypePixel(440)).toBe(1)
  })
})

describe('gridInverse', () => {
  it('uses the inverse of the scene while a grid is found', () => {
    const scene = stepScene(createScene({ width: 402, height: 874 }), skewed, 0, false)
    expect(gridInverse(scene)).toBe(scene.inverse)
  })

  it('computes the inverse of the last grid after a loss', () => {
    const scene = stepScene(createScene({ width: 402, height: 874 }), skewed, 0, false)
    stepScene(scene, null, 0.1, false)
    expect(scene.inverse).toBeNull()
    expect(gridInverse(scene)).toEqual(invert(unitToQuad(skewed)!))
  })

  it('gives null before any grid', () => {
    expect(gridInverse(createScene({ width: 402, height: 874 }))).toBeNull()
  })
})
