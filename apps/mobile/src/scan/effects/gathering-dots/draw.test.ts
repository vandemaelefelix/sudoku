import type { Quad } from '../../../scanner'
import { SPRITE_SIZE } from '../common/sprite'
import { makeDrawKit } from '../kit'
import { createScene, stepScene } from '../scene'
import { drawField, STAR_SCALE } from './draw'
import { createField, DIM_OUTSIDE, DIM_SEARCH, stepField } from './field'

const VIEW = { width: 402, height: 874 }

function fakeCanvas() {
  return { drawAtlas: jest.fn(), drawPath: jest.fn() }
}

function world() {
  return { scene: createScene(VIEW), field: createField(VIEW), kit: makeDrawKit([]) }
}

const fillOf = (kit: ReturnType<typeof makeDrawKit>) => kit.fill as unknown as { setAlphaf: jest.Mock }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('drawField', () => {
  it('draws every dot with one atlas call, with the sprite and the paint of the kit', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawAtlas).toHaveBeenCalledTimes(1)
    const [image, srcs, dsts, paint, , colors] = canvas.drawAtlas.mock.calls[0]
    expect(image).toBe(w.kit.sprite)
    expect(paint).toBe(w.kit.atlas)
    expect(srcs).toHaveLength(312)
    expect(dsts).toHaveLength(312)
    expect(colors).toHaveLength(312)
  })

  it('draws a star 9 × the dot radius wide, centred on the dot', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
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
    drawField(canvas as never, w.field, w.scene, w.kit)
    const colors = canvas.drawAtlas.mock.calls[0][5]
    expect(colors[7][3]).toBeCloseTo(w.field.dots[7].alpha)
  })

  it('clamps the dot alpha to 1', () => {
    const w = world()
    w.field.dots[0].alpha = 1.4
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawAtlas.mock.calls[0][5][0][3]).toBe(1)
  })

  it('dims the whole view while searching', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    expect(canvas.drawPath.mock.calls[0][1]).toBe(w.kit.fill)
    expect(fillOf(w.kit).setAlphaf).toHaveBeenCalledWith(DIM_SEARCH)
  })

  it('dims only outside the grid once the grid is found', () => {
    const w = world()
    for (let t = 0; t <= 1; t += 1 / 60) {
      stepScene(w.scene, grid, t, false)
      stepField(w.field, w.scene)
    }
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    expect(canvas.drawPath.mock.calls[0][0].calls).toContainEqual(['setFillType', 1])
    expect(fillOf(w.kit).setAlphaf).toHaveBeenCalledWith(DIM_OUTSIDE)
  })

  it('dims both the view and the outside of the grid while the grid fades in', () => {
    const w = world()
    w.scene.presence = 0.5
    w.scene.lastQuad = grid
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(2)
    expect(canvas.drawPath.mock.calls[0][0].calls).not.toContainEqual(['setFillType', 1])
    expect(canvas.drawPath.mock.calls[1][0].calls).toContainEqual(['setFillType', 1])
    expect(fillOf(w.kit).setAlphaf.mock.calls).toEqual([[DIM_SEARCH * 0.5], [DIM_OUTSIDE * 0.5]])
  })
})
