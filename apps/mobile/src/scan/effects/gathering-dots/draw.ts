import { BlendMode, type SkCanvas, Skia } from '@shopify/react-native-skia'
import { drawDim } from '@/scan/effects/common/dim'
import { SPRITE_SIZE } from '@/scan/effects/common/sprite'
import type { Scene } from '@/scan/effects/scene'
import type { DrawKit } from '@/scan/effects/types'
import { DIM, type FieldState } from './field'

/** The width of a drawn star as a multiple of the dot radius. */
export const STAR_SCALE = 9

/** Draws the dim as paths, then every dot in one atlas call with kit.sprite. Runs on the UI thread inside createPicture. */
export function drawField(canvas: SkCanvas, state: FieldState, scene: Scene, kit: DrawKit): void {
  'worklet'
  const capture = scene.capture
  const fade = capture == null ? 1 : 1 - capture.dim
  // One even dim, also over the grid: only the dots show where the grid is.
  drawDim(canvas, kit.fill, scene.width, scene.height, null, DIM * fade)
  // The capture phase turns the gathered dots from white to ink. The free dots stay white.
  const ink = capture == null ? 0 : capture.ink
  const r = 1 + (kit.ink[0] - 1) * ink
  const g = 1 + (kit.ink[1] - 1) * ink
  const b = 1 + (kit.ink[2] - 1) * ink
  const srcs = []
  const dsts = []
  const colors = []
  for (const d of state.dots) {
    const scale = (STAR_SCALE * d.radius) / SPRITE_SIZE
    const offset = scale * (SPRITE_SIZE / 2)
    const alpha = Math.min(1, d.alpha)
    srcs.push(kit.spriteRect)
    dsts.push(Skia.RSXform(scale, 0, d.x - offset, d.y - offset))
    colors.push(d.target >= 0 ? new Float32Array([r, g, b, alpha]) : new Float32Array([1, 1, 1, alpha]))
  }
  canvas.drawAtlas(kit.sprite, srcs, dsts, kit.atlas, BlendMode.Modulate, colors)
}
