import { BlendMode, FillType, type SkCanvas, type SkImage, Skia, TileMode } from '@shopify/react-native-skia'
import type { Quad } from '../../scanner'
import { DIM_OUTSIDE, DIM_SEARCH, type FieldState } from './field'

/** The width of a drawn star as a multiple of the dot radius. */
export const STAR_SCALE = 9
/** Pixels. Sharp at 3x density for the largest dot: radius 1.25 × 1.7 pt gives a star of about 19 pt. */
export const SPRITE_SIZE = 64

/** A white core with a soft halo that fades out at the image edge, which is 4.5 radii from the centre. */
export function makeStarSprite(): SkImage {
  'worklet'
  const surface = Skia.Surface.Make(SPRITE_SIZE, SPRITE_SIZE)
  if (surface == null) throw new Error('Cannot make the star sprite surface')
  const half = SPRITE_SIZE / 2
  const paint = Skia.Paint()
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: half, y: half },
      half,
      [
        Skia.Color('rgba(255,255,255,1)'),
        Skia.Color('rgba(255,255,255,1)'),
        Skia.Color('rgba(255,255,255,0.3)'),
        Skia.Color('rgba(255,255,255,0)'),
      ],
      [0, 0.2, 0.45, 1],
      TileMode.Clamp,
    ),
  )
  surface.getCanvas().drawPaint(paint)
  return surface.makeImageSnapshot()
}

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

/** Draws one frame: the dim as paths, the dots in one atlas call. Runs on the UI thread inside createPicture. sprite: from makeStarSprite. */
export function drawField(canvas: SkCanvas, state: FieldState, sprite: SkImage): void {
  'worklet'
  const dim = Skia.Paint()
  dim.setAntiAlias(true)
  dim.setColor(Skia.Color('#000000'))
  if (state.presence > 0 && state.lastQuad != null) {
    const search = DIM_SEARCH * (1 - state.presence)
    if (search > 0) {
      const full = Skia.Paint()
      full.setColor(Skia.Color('#000000'))
      full.setAlphaf(search)
      canvas.drawPath(viewPath(state.width, state.height), full)
    }
    dim.setAlphaf(DIM_OUTSIDE * state.presence)
    canvas.drawPath(withHole(state.width, state.height, state.lastQuad), dim)
  } else {
    dim.setAlphaf(DIM_SEARCH)
    canvas.drawPath(viewPath(state.width, state.height), dim)
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
