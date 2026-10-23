import { IDENTITY, prototypePixel, prototypeScale, toColumnMajor } from '@/scan/effects/common/shaderMatrix'
import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, type Scene, stepScene } from '@/scan/effects/scene'
import { ripples } from './ripples.effect'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'
import { cobalt } from '@/theme/themes/cobalt'
import { fakeCanvas, foundScene, VIEW } from '@/scan/effects/effect.testkit'

const INK = cobalt.components.grid.boxLine

type MockShaderEffect = { makeShader: jest.Mock }

/** The uniforms of the one makeShader call of a draw. */
function drawnUniforms(scene: Scene) {
  const kit = makeDrawKit([ripples], INK)
  const canvas = fakeCanvas()
  ripples.draw(canvas as never, ripples.create(scene), scene, kit)
  const effect = kit.shaders.ripples as unknown as MockShaderEffect
  return { canvas, kit, uniforms: effect.makeShader.mock.calls[0][0] as number[] }
}

describe('rippleUniforms', () => {
  it('gives the 15 floats in the order of the shader uniforms', () => {
    const scene = { ...foundScene(), lockProgress: 0.6 }
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
    const scene = { ...foundScene(), reduceMotion: true, lockedAt: 0.25 }
    expect(rippleUniforms(scene, IDENTITY, 0)[13]).toBe(-1)
  })
})

describe('ripples', () => {
  it('is the screen effect with a stable id and its SkSL', () => {
    expect(ripples.id).toBe('ripples')
    expect(ripples.name).toBe('Ripples')
    expect(ripples.family).toBe('screen')
    expect(ripples.sksl).toBe(RIPPLES_SKSL)
    const scene = foundScene()
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
    const scene = foundScene()
    const { uniforms } = drawnUniforms(scene)
    expect(uniforms.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(uniforms[11]).toBe(1)
  })

  it('stops its time under Reduce Motion', () => {
    const scene = foundScene()
    const kit = makeDrawKit([ripples], INK)
    ripples.draw(fakeCanvas() as never, ripples.create(scene), { ...scene, t: scene.t + 2, reduceMotion: true }, kit)
    const effect = kit.shaders.ripples as unknown as MockShaderEffect
    expect(effect.makeShader.mock.calls[0][0][10]).toBe(0)
  })

  it('draws nothing when its shader did not compile', () => {
    const scene = foundScene()
    const canvas = fakeCanvas()
    ripples.draw(canvas as never, ripples.create(scene), scene, makeDrawKit([], INK))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
