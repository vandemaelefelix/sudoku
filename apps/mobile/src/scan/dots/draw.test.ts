import type { Quad } from '../../scanner'
import { createScene, stepScene } from '../effects/scene'
import { drawField, makeStarSprite, SPRITE_SIZE, STAR_SCALE } from './draw'
import { createField, DIM_OUTSIDE, DIM_SEARCH, stepField } from './field'

const VIEW = { width: 402, height: 874 }

function fakeCanvas() {
  return { drawAtlas: jest.fn(), drawPath: jest.fn() }
}

function world() {
  return { scene: createScene(VIEW), field: createField(VIEW) }
}

const sprite = makeStarSprite()

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('drawField', () => {
  it('draws every dot with one atlas call', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    expect(canvas.drawAtlas).toHaveBeenCalledTimes(1)
    const [, srcs, dsts, , , colors] = canvas.drawAtlas.mock.calls[0]
    expect(srcs).toHaveLength(312)
    expect(dsts).toHaveLength(312)
    expect(colors).toHaveLength(312)
  })

  it('draws a star 9 × the dot radius wide, centred on the dot', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    const dsts = canvas.drawAtlas.mock.calls[0][2]
    const dot = w.field.dots[5]
    const { scos, ssin, tx, ty } = dsts[5]
    expect(STAR_SCALE).toBe(9)
    expect(ssin).toBe(0)
    expect(scos * SPRITE_SIZE).toBeCloseTo(9 * dot.radius)
    expect(tx + (scos * SPRITE_SIZE) / 2).toBeCloseTo(dot.x)
    expect(ty + (scos * SPRITE_SIZE) / 2).toBeCloseTo(dot.y)
  })

  it('gives each dot a colour with the dot alpha', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    const colors = canvas.drawAtlas.mock.calls[0][5]
    expect(colors[7][3]).toBeCloseTo(Math.min(1, w.field.dots[7].alpha))
  })

  it('dims the whole view while searching', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    const paint = canvas.drawPath.mock.calls[0][1]
    expect(paint.setAlphaf).toHaveBeenCalledWith(DIM_SEARCH)
  })

  it('dims only outside the grid once the grid is found', () => {
    const w = world()
    for (let t = 0; t <= 1; t += 1 / 60) {
      stepScene(w.scene, grid, t, false)
      stepField(w.field, w.scene)
    }
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    const [path, paint] = canvas.drawPath.mock.calls[0]
    expect(path.calls).toContainEqual(['setFillType', 1])
    expect(paint.setAlphaf).toHaveBeenCalledWith(DIM_OUTSIDE)
  })
})
