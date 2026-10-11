import { BlendMode, FillType, type SkCanvas, type SkImage, Skia } from '@shopify/react-native-skia'
import type { Quad } from '../../scanner'
import { SPRITE_SIZE } from '../effects/common/sprite'
import type { Scene } from '../effects/scene'
import { DIM_OUTSIDE, DIM_SEARCH, type FieldState } from './field'

/** The width of a drawn star as a multiple of the dot radius. */
export const STAR_SCALE = 9

function viewPath(width: number, height: number) {
  'worklet'
  return Skia.Path.Make().moveTo(0, 0).lineTo(width, 0).lineTo(width, height).lineTo(0, height).close()
}

function withHole(width: number, height: number, quad: Quad) {
  'worklet'
  return viewPath(width, height)
    .moveTo(quad[0].x, quad[0].y)
    .lineTo(quad[1].x, quad[1].y)
    .lineTo(quad[2].x, quad[2].y)
    .lineTo(quad[3].x, quad[3].y)
    .close()
    .setFillType(FillType.EvenOdd)
}

/** Draws the dim as paths, then every dot in one atlas call with the star sprite. Runs on the UI thread inside createPicture. sprite: from makeStarSprite. */
export function drawField(canvas: SkCanvas, state: FieldState, scene: Scene, sprite: SkImage): void {
  'worklet'
  const dim = Skia.Paint()
  dim.setAntiAlias(true)
  dim.setColor(Skia.Color('#000000'))
  if (scene.presence > 0 && scene.lastQuad != null) {
    const search = DIM_SEARCH * (1 - scene.presence)
    if (search > 0) {
      const full = Skia.Paint()
      full.setColor(Skia.Color('#000000'))
      full.setAlphaf(search)
      canvas.drawPath(viewPath(scene.width, scene.height), full)
    }
    dim.setAlphaf(DIM_OUTSIDE * scene.presence)
    canvas.drawPath(withHole(scene.width, scene.height, scene.lastQuad), dim)
  } else {
    dim.setAlphaf(DIM_SEARCH)
    canvas.drawPath(viewPath(scene.width, scene.height), dim)
  }

  const whole = Skia.XYWHRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  const srcs = []
  const dsts = []
  const colors = []
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    const scale = (STAR_SCALE * d.radius) / SPRITE_SIZE
    const offset = scale * (SPRITE_SIZE / 2)
    srcs.push(whole)
    dsts.push(Skia.RSXform(scale, 0, d.x - offset, d.y - offset))
    colors.push(new Float32Array([1, 1, 1, Math.min(1, d.alpha)]))
  }
  const atlas = Skia.Paint()
  atlas.setAntiAlias(true)
  canvas.drawAtlas(sprite, srcs, dsts, atlas, BlendMode.Modulate, colors)
}
