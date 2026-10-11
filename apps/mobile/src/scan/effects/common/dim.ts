import { FillType, type SkCanvas, type SkPaint, Skia } from '@shopify/react-native-skia'
import type { Quad } from '@/scanner'

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

/** A black dim over the view. quad: the hole, or null for no hole. alpha: 0..1, clamped. Sets the colour and alpha of paint. */
export function drawDim(
  canvas: SkCanvas,
  paint: SkPaint,
  width: number,
  height: number,
  quad: Quad | null,
  alpha: number,
): void {
  'worklet'
  if (alpha <= 0) return
  paint.setColor(Skia.Color('#000000'))
  paint.setAlphaf(Math.min(1, alpha))
  canvas.drawPath(quad == null ? viewPath(width, height) : withHole(width, height, quad), paint)
}
