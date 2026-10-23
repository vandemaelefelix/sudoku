import { IDENTITY, prototypePixel, toColumnMajor } from '@/scan/effects/common/shaderMatrix'
import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, type Scene, stepScene } from '@/scan/effects/scene'
import { gridLattice } from './grid-lattice.effect'
import { LATTICE_SKSL } from './shader'
import { latticeUniforms } from './uniforms'
import type { Quad } from '@/utils/geometry.utils'
import { cobalt } from '@/theme/themes/cobalt'

const INK = cobalt.components.grid.boxLine

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

/** A scene one second after the grid was found, so presence is 1. */
function found(): Scene {
  const scene = createScene(VIEW)
  for (let t = 0; t <= 1; t += 1 / 60) stepScene(scene, grid, t, false)
  return scene
}

function fakeCanvas() {
  return { drawRect: jest.fn() }
}

type MockShaderEffect = { makeShader: jest.Mock }

describe('latticeUniforms', () => {
  it('gives the 14 floats in the order of the shader uniforms', () => {
    const scene = { ...found(), lockProgress: 0.6 }
    const u = latticeUniforms(scene, scene.inverse!, 2.5)
    expect(u).toHaveLength(14)
    expect(u.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(u[9]).toBe(prototypePixel(402))
    expect(u[10]).toBe(2.5)
    expect(u[11]).toBe(scene.presence)
    expect(u[12]).toBe(scene.lockProgress)
    expect(u[13]).toBe(-1)
  })

  it('gives the seconds since lock-on as the lock-on time', () => {
    const scene = { ...found(), lockedAt: 0.25 }
    expect(latticeUniforms(scene, IDENTITY, 0)[13]).toBeCloseTo(scene.t - 0.25, 9)
  })

  it('stops the lock-on reaction under Reduce Motion', () => {
    const scene = { ...found(), reduceMotion: true, lockedAt: 0.25 }
    expect(latticeUniforms(scene, IDENTITY, 0)[13]).toBe(-1)
  })
})

describe('gridLattice', () => {
  it('is the shader effect with a stable id and its SkSL', () => {
    expect(gridLattice.id).toBe('grid-lattice')
    expect(gridLattice.name).toBe('Grid lattice')
    expect(gridLattice.family).toBe('shader')
    expect(gridLattice.sksl).toBe(LATTICE_SKSL)
  })

  it('counts its shader time from its creation', () => {
    const scene = found()
    const clock = gridLattice.create(scene)
    expect(clock.start).toBe(scene.t)
    expect(gridLattice.step(clock, scene)).toBe(clock)
  })

  it('fills the view with the lattice shader in one draw call', () => {
    const scene = found()
    const kit = makeDrawKit([gridLattice], INK)
    const canvas = fakeCanvas()
    gridLattice.draw(canvas as never, gridLattice.create(scene), scene, kit)
    const effect = kit.shaders['grid-lattice'] as unknown as MockShaderEffect
    expect(effect.makeShader).toHaveBeenCalledTimes(1)
    expect(effect.makeShader.mock.calls[0][0]).toHaveLength(14)
    expect((kit.shader as unknown as { setShader: jest.Mock }).setShader).toHaveBeenCalledWith(
      effect.makeShader.mock.results[0]?.value,
    )
    expect(canvas.drawRect).toHaveBeenCalledWith({ x: 0, y: 0, width: 402, height: 874 }, kit.shader)
  })

  it('stops its time under Reduce Motion', () => {
    const scene = found()
    const clock = gridLattice.create(scene)
    const kit = makeDrawKit([gridLattice], INK)
    gridLattice.draw(fakeCanvas() as never, clock, { ...scene, t: scene.t + 2, reduceMotion: true }, kit)
    const effect = kit.shaders['grid-lattice'] as unknown as MockShaderEffect
    expect(effect.makeShader.mock.calls[0][0][10]).toBe(0)
  })

  it('draws nothing before a grid is found', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const canvas = fakeCanvas()
    gridLattice.draw(canvas as never, gridLattice.create(scene), scene, makeDrawKit([gridLattice], INK))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })

  it('draws nothing when its shader did not compile', () => {
    const scene = found()
    const canvas = fakeCanvas()
    gridLattice.draw(canvas as never, gridLattice.create(scene), scene, makeDrawKit([], INK))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
