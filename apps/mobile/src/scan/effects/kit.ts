import { PaintStyle, type SkRuntimeEffect, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import { makeStarSprite, SPRITE_SIZE } from './common/sprite'
import type { AnyEffect, DrawKit } from './types'

function logShaderError(id: string, error: unknown) {
  if (__DEV__) console.log(`[fx] ${id} shader failed: ${error instanceof Error ? error.message : String(error)}`)
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

/** Runs once on the JS thread. Skia objects are host objects, so the frame worklet can capture the kit. */
export function makeDrawKit(effects: readonly AnyEffect[]): DrawKit {
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
  }
}
