import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, stepScene } from '@/scan/effects/scene'
import { gatheringDots } from './gathering-dots.effect'
import type { Quad } from '@/utils/geometry.utils'
import { daylight } from '@/theme/themes/daylight'

const INK = daylight.components.grid.boxLine

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('gatheringDots', () => {
  it('is the simulation effect with a stable id', () => {
    expect(gatheringDots.id).toBe('gathering-dots')
    expect(gatheringDots.name).toBe('Gathering dots')
    expect(gatheringDots.family).toBe('simulation')
  })

  it('creates a field with the dot density of the view', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    expect(gatheringDots.create(scene).dots).toHaveLength(312)
  })

  it('gathers 100 dots when the scene has a grid', () => {
    const scene = stepScene(createScene(VIEW), grid, 0, false)
    const state = gatheringDots.step(gatheringDots.create(scene), scene)
    expect(state.dots.filter((d) => d.target >= 0)).toHaveLength(100)
  })

  it('draws the dots in one atlas call', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const canvas = { drawAtlas: jest.fn(), drawPath: jest.fn() }
    gatheringDots.draw(canvas as never, gatheringDots.create(scene), scene, makeDrawKit([], INK))
    expect(canvas.drawAtlas).toHaveBeenCalledTimes(1)
  })
})
