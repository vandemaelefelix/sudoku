import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, stepScene } from '@/scan/effects/scene'
import { gatheringDots } from './gathering-dots.effect'
import { cobalt } from '@/theme/themes/cobalt'
import { GRID, VIEW } from '@/scan/effects/effect.testkit'

const INK = cobalt.components.grid.boxLine

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
    const scene = stepScene(createScene(VIEW), GRID, 0, false)
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
