import { PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import { makeDrawKit } from './kit'
import type { AnyEffect } from './types'
import { cobalt } from '@/theme/themes/cobalt'
import { forest } from '@/theme/themes/forest'

const INK = cobalt.components.grid.boxLine

const make = jest.mocked(Skia.RuntimeEffect.Make)

function fakeEffect(id: string, sksl?: string): AnyEffect {
  return {
    id,
    name: id,
    family: 'shader',
    ...(sksl === undefined ? {} : { sksl }),
    create: () => null,
    step: (state) => state,
    draw: () => undefined,
  }
}

describe('makeDrawKit', () => {
  it('compiles the shader of each effect once, by id', () => {
    const kit = makeDrawKit([fakeEffect('a', 'half4 main(float2 p) { return half4(1); }'), fakeEffect('b')], INK)
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
    const kit = makeDrawKit([fakeEffect('bad', 'x'), fakeEffect('good', 'y')], INK)
    expect(kit.shaders.bad).toBeNull()
    expect(kit.shaders.good).not.toBeNull()
    expect(log).toHaveBeenCalledWith('[fx] bad shader failed: Error in sksl: bad')
    log.mockRestore()
  })

  it('sets up the stroke paint once, with round caps and joins', () => {
    const stroke = makeDrawKit([], INK).stroke as unknown as Record<string, jest.Mock>
    expect(stroke.setStyle).toHaveBeenCalledWith(PaintStyle.Stroke)
    expect(stroke.setStrokeCap).toHaveBeenCalledWith(StrokeCap.Round)
    expect(stroke.setStrokeJoin).toHaveBeenCalledWith(StrokeJoin.Round)
  })

  it.each([cobalt, forest])('gives the $name ink it is given as RGB from 0 to 1', (theme) => {
    const ink = theme.components.grid.boxLine
    const value = Number.parseInt(ink.slice(1), 16)
    expect(makeDrawKit([], ink).ink).toEqual([(value >> 16) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255])
  })

  it('makes the star sprite once', () => {
    makeDrawKit([], INK)
    expect(jest.mocked(Skia.Surface.Make)).toHaveBeenCalledTimes(1)
  })
})
