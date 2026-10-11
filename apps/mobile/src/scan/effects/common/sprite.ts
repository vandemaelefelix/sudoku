import { type SkImage, Skia, TileMode } from '@shopify/react-native-skia'
import { SPRITE_SIZE } from './common.constants'

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
