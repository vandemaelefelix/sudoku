import { type Channels, transitionAt } from '@/scan/utils/transition.utils'
import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, stepScene } from '@/scan/effects/scene'
import { drawField } from './draw'
import { createField, stepField } from './field'
import type { Quad } from '@/utils/geometry.utils'
import { TRANSITION_END } from '@/scan/constants/transition.constants'
import { DIM, STAR_SCALE } from './gathering-dots.constants'
import { SPRITE_SIZE } from '@/scan/effects/common/common.constants'
import { daylight } from '@/theme/themes/daylight'

const INK = daylight.components.grid.boxLine

const VIEW = { width: 402, height: 874 }

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}

function fakeCanvas() {
  return { drawAtlas: jest.fn(), drawPath: jest.fn() }
}

function world() {
  return { scene: createScene(VIEW), field: createField(VIEW), kit: makeDrawKit([], INK) }
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
    const dot = itemAt(w.field.dots, 5)
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
    expect(colors[7][3]).toBeCloseTo(itemAt(w.field.dots, 7).alpha)
  })

  it('clamps the dot alpha to 1', () => {
    const w = world()
    itemAt(w.field.dots, 0).alpha = 1.4
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
    expect(fillOf(w.kit).setAlphaf).toHaveBeenCalledWith(DIM)
  })

  it('keeps the same even dim over the grid once the grid is found', () => {
    const w = world()
    for (let t = 0; t <= 1; t += 1 / 60) {
      stepScene(w.scene, grid, t, false)
      stepField(w.field, w.scene)
    }
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    expect(canvas.drawPath.mock.calls[0][0].calls).not.toContainEqual(['setFillType', 1])
    expect(fillOf(w.kit).setAlphaf.mock.calls).toEqual([[DIM]])
  })
})

/** Locks on a still grid, then draws one capture frame with these channels. */
function captured(channels: Channels) {
  const w = world()
  for (let t = 0; t <= 2.5; t += 1 / 60) {
    stepScene(w.scene, grid, t, false)
    stepField(w.field, w.scene)
  }
  w.scene.presence = 0.5
  w.scene.capture = channels
  stepField(w.field, w.scene)
  const canvas = fakeCanvas()
  drawField(canvas as never, w.field, w.scene, w.kit)
  return { w, canvas, colors: canvas.drawAtlas.mock.calls[0][5] as Float32Array[] }
}
const gatheredIndex = (w: ReturnType<typeof world>) => w.field.dots.findIndex((d) => d.target >= 0)
const freeIndex = (w: ReturnType<typeof world>) => w.field.dots.findIndex((d) => d.target < 0)

describe('drawField in the capture phase', () => {
  it('fades the dim by 1 − dim', () => {
    const { w } = captured({ ...transitionAt(0, false), dim: 0.75 })
    const alphas = fillOf(w.kit).setAlphaf.mock.calls.map((call) => call[0] as number)
    expect(alphas).toHaveLength(1)
    expect(alphas[0]).toBeCloseTo(DIM * 0.25, 9)
  })

  it('draws no dim and no visible dot at the end of the transition', () => {
    const { canvas, colors } = captured(transitionAt(TRANSITION_END, false))
    expect(canvas.drawPath).not.toHaveBeenCalled()
    for (const c of colors) expect(c[3]).toBe(0)
  })

  it('draws the gathered dots white before the ink ramp', () => {
    const { w, colors } = captured(transitionAt(0, false))
    expect(Array.from(itemAt(colors, gatheredIndex(w)).slice(0, 3))).toEqual([1, 1, 1])
  })

  it('draws the gathered dots in ink at ink 1, and keeps the free dots white', () => {
    const { w, colors } = captured({ ...transitionAt(0, false), ink: 1 })
    const c = itemAt(colors, gatheredIndex(w))
    const [r, g, b] = w.kit.ink
    expect(c[0]).toBeCloseTo(r, 6)
    expect(c[1]).toBeCloseTo(g, 6)
    expect(c[2]).toBeCloseTo(b, 6)
    expect(Array.from(itemAt(colors, freeIndex(w)).slice(0, 3))).toEqual([1, 1, 1])
  })
})
