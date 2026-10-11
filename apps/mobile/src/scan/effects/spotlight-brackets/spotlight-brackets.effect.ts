import { type SkCanvas, type SkPath, Skia } from '@shopify/react-native-skia'
import { drawDim } from '@/scan/effects/common/dim'
import { prototypeScale } from '@/scan/effects/common/shaderMatrix'
import type { Scene } from '@/scan/effects/scene'
import type { DrawKit, Effect } from '@/scan/effects/types'
import type { Point, Quad } from '@/utils/geometry.utils'

// Prototype section 1, "Spotlight and brackets". p is scene.lockProgress.
/** Dim outside the grid: presence × (DIM_BASE + DIM_STEADY × p). */
export const DIM_BASE = 0.3
export const DIM_STEADY = 0.22
/** Bracket length as a share of each edge: BRACKET_BASE + BRACKET_STEADY × p². */
export const BRACKET_BASE = 0.12
export const BRACKET_STEADY = 0.38
/** Prototype points. */
export const BRACKET_WIDTH = 2.6

/** a: the previous corner. c: the corner. b: the next corner. */
function addBracket(path: SkPath, a: Point, c: Point, b: Point, share: number) {
  'worklet'
  path.moveTo(c.x + (a.x - c.x) * share, c.y + (a.y - c.y) * share)
  path.lineTo(c.x, c.y)
  path.lineTo(c.x + (b.x - c.x) * share, c.y + (b.y - c.y) * share)
}

/** One L per corner: share of the edge to the previous corner, the corner, share of the edge to the next corner. */
export function bracketPath(quad: Quad, share: number) {
  'worklet'
  const path = Skia.Path.Make()
  const [q0, q1, q2, q3] = quad
  addBracket(path, q3, q0, q1, share)
  addBracket(path, q0, q1, q2, share)
  addBracket(path, q1, q2, q3, share)
  addBracket(path, q2, q3, q0, share)
  return path
}

function create(): null {
  'worklet'
  return null
}

function step(state: null): null {
  'worklet'
  return state
}

function draw(canvas: SkCanvas, _state: null, scene: Scene, kit: DrawKit): void {
  'worklet'
  const quad = scene.lastQuad
  if (quad == null || scene.presence <= 0) return
  const p = scene.lockProgress
  drawDim(canvas, kit.fill, scene.width, scene.height, quad, scene.presence * (DIM_BASE + DIM_STEADY * p))
  kit.stroke.setColor(Skia.Color('#ffffff'))
  kit.stroke.setAlphaf(scene.presence)
  kit.stroke.setStrokeWidth(BRACKET_WIDTH * prototypeScale(scene.width))
  canvas.drawPath(bracketPath(quad, BRACKET_BASE + BRACKET_STEADY * p * p), kit.stroke)
}

export const spotlightBrackets: Effect<null> = {
  id: 'spotlight-brackets',
  name: 'Spotlight and brackets',
  family: 'path',
  create,
  step,
  draw,
}
