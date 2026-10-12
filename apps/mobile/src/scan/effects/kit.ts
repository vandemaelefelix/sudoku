import { PaintStyle, type SkRuntimeEffect, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import { makeStarSprite } from './common/sprite'
import type { AnyEffect, DrawKit } from './types'
import { devLog, errorMessage } from '@/utils/log.utils'
import { SPRITE_SIZE } from '@/scan/effects/common/common.constants'

function logShaderError(id: string, error: unknown) {
  devLog('fx', `${id} shader failed: ${errorMessage(error)}`)
}

/** Null when the source does not compile. Skia throws on a compile error. */
export function compileShader(id: string, sksl: string): SkRuntimeEffect | null {
  try {
    const effect = Skia.RuntimeEffect.Make(sksl)
    if (effect == null) logShaderError(id, 'no runtime effect')
    return effect
  } catch (error) {
    logShaderError(id, error)
    return null
  }
}

/** hex: '#rrggbb'. Returns each channel as 0..1. */
function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]
}

/**
 * Runs on the JS thread, once per theme. Skia objects are host objects, so the frame worklet can capture the kit.
 * ink: '#rrggbb'.
 */
export function makeDrawKit(effects: readonly AnyEffect[], ink: string): DrawKit {
  const fill = Skia.Paint()
  fill.setAntiAlias(true)
  const stroke = Skia.Paint()
  stroke.setAntiAlias(true)
  stroke.setStyle(PaintStyle.Stroke)
  stroke.setStrokeCap(StrokeCap.Round)
  stroke.setStrokeJoin(StrokeJoin.Round)
  const atlas = Skia.Paint()
  atlas.setAntiAlias(true)
  const shader = Skia.Paint()
  const shaders: { [id: string]: SkRuntimeEffect | null } = {}
  for (const effect of effects) {
    if (effect.sksl != null) shaders[effect.id] = compileShader(effect.id, effect.sksl)
  }
  return {
    sprite: makeStarSprite(),
    spriteRect: Skia.XYWHRect(0, 0, SPRITE_SIZE, SPRITE_SIZE),
    fill,
    stroke,
    atlas,
    shader,
    shaders,
    ink: rgb(ink),
  }
}
