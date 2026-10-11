import { PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import { makeDrawKit } from './kit'
import type { AnyEffect } from './types'

const make = jest.mocked(Skia.RuntimeEffect.Make)

function fakeEffect(id: string, sksl?: string): AnyEffect {
  return { id, name: id, family: 'shader', sksl, create: () => null, step: (state) => state, draw: () => undefined }
}

beforeEach(() => jest.clearAllMocks())

describe('makeDrawKit', () => {
  it('compiles the shader of each effect once, by id', () => {
    const kit = makeDrawKit([fakeEffect('a', 'half4 main(float2 p) { return half4(1); }'), fakeEffect('b')])
    expect(make).toHaveBeenCalledTimes(1)
    expect(make).toHaveBeenCalledWith('half4 main(float2 p) { return half4(1); }')
    expect(kit.shaders.a).not.toBeNull()
    expect('b' in kit.shaders).toBe(false)
  })

  it('keeps the other effects when a shader does not compile', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    make.mockImplementationOnce(() => {
      throw new Error('Error in sksl: bad')
    })
    const kit = makeDrawKit([fakeEffect('bad', 'x'), fakeEffect('good', 'y')])
    expect(kit.shaders.bad).toBeNull()
    expect(kit.shaders.good).not.toBeNull()
    expect(log).toHaveBeenCalledWith('[fx] bad shader failed: Error in sksl: bad')
    log.mockRestore()
  })

  it('sets up the stroke paint once, with round caps and joins', () => {
    const stroke = makeDrawKit([]).stroke as unknown as Record<string, jest.Mock>
    expect(stroke.setStyle).toHaveBeenCalledWith(PaintStyle.Stroke)
    expect(stroke.setStrokeCap).toHaveBeenCalledWith(StrokeCap.Round)
    expect(stroke.setStrokeJoin).toHaveBeenCalledWith(StrokeJoin.Round)
  })

  it('makes the star sprite once', () => {
    makeDrawKit([])
    expect(jest.mocked(Skia.Surface.Make)).toHaveBeenCalledTimes(1)
  })
})
