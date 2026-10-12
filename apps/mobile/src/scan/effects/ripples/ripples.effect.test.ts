import { IDENTITY, prototypePixel, prototypeScale, toColumnMajor } from '@/scan/effects/common/shaderMatrix'
import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, type Scene, stepScene } from '@/scan/effects/scene'
import { ripples } from './ripples.effect'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'
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

/** The uniforms of the one makeShader call of a draw. */
function drawnUniforms(scene: Scene) {
  const kit = makeDrawKit([ripples], INK)
  const canvas = fakeCanvas()
  ripples.draw(canvas as never, ripples.create(scene), scene, kit)
  const effect = kit.shaders.ripples as unknown as MockShaderEffect
  return { canvas, kit, uniforms: effect.makeShader.mock.calls[0][0] as number[] }
}

beforeEach(() => jest.clearAllMocks())

describe('rippleUniforms', () => {
  it('gives the 15 floats in the order of the shader uniforms', () => {
    const scene = { ...found(), lockProgress: 0.6 }
    const u = rippleUniforms(scene, scene.inverse!, 2.5)
    expect(u).toHaveLength(15)
    expect(u.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(u[9]).toBe(prototypePixel(402))
    expect(u[10]).toBe(2.5)
    expect(u[11]).toBe(scene.presence)
    expect(u[12]).toBe(scene.lockProgress)
    expect(u[13]).toBe(-1)
    expect(u[14]).toBe(prototypeScale(402))
  })

  it('stops the burst ring under Reduce Motion', () => {
    const scene = { ...found(), reduceMotion: true, lockedAt: 0.25 }
    expect(rippleUniforms(scene, IDENTITY, 0)[13]).toBe(-1)
  })
})

describe('ripples', () => {
  it('is the screen effect with a stable id and its SkSL', () => {
    expect(ripples.id).toBe('ripples')
    expect(ripples.name).toBe('Ripples')
    expect(ripples.family).toBe('screen')
    expect(ripples.sksl).toBe(RIPPLES_SKSL)
    const scene = found()
    const clock = ripples.create(scene)
    expect(clock.start).toBe(scene.t)
    expect(ripples.step(clock, scene)).toBe(clock)
  })

  it('draws the plain dot screen while searching', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const { canvas, kit, uniforms } = drawnUniforms(scene)
    expect(uniforms.slice(0, 9)).toEqual(toColumnMajor(IDENTITY))
    expect(uniforms[11]).toBe(0)
    expect(canvas.drawRect).toHaveBeenCalledWith({ x: 0, y: 0, width: 402, height: 874 }, kit.shader)
  })

  it('sends the waves out from the grid once it is found', () => {
    const scene = found()
    const { uniforms } = drawnUniforms(scene)
    expect(uniforms.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(uniforms[11]).toBe(1)
  })

  it('stops its time under Reduce Motion', () => {
    const scene = found()
    const kit = makeDrawKit([ripples], INK)
    ripples.draw(fakeCanvas() as never, ripples.create(scene), { ...scene, t: scene.t + 2, reduceMotion: true }, kit)
    const effect = kit.shaders.ripples as unknown as MockShaderEffect
    expect(effect.makeShader.mock.calls[0][0][10]).toBe(0)
  })

  it('draws nothing when its shader did not compile', () => {
    const scene = found()
    const canvas = fakeCanvas()
    ripples.draw(canvas as never, ripples.create(scene), scene, makeDrawKit([], INK))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
