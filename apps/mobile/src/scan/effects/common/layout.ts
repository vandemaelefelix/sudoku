import type { Point } from '../../../scanner'
import type { ViewSize } from '../../previewMapping'

/** Points between dot homes. The 402 × 874 pt reference view gets 12 × 26 = 312 dots. */
export const DOT_SPACING = 33.5
/** Share of a cell that a home may move from the cell centre. */
const JITTER = 0.3
/** Points. */
export const WANDER_MIN = 5
export const WANDER_MAX = 9
/** Share of the opacity that the twinkle adds or removes. */
export const TWINKLE = 0.28

/** homeX, homeY: points. ax, ay: wander amplitude in points. fx, fy, tw: rad/s. px, py: phases in radians. size: radius in points. */
export type Dot = {
  homeX: number
  homeY: number
  ax: number
  ay: number
  fx: number
  fy: number
  px: number
  py: number
  size: number
  tw: number
}

/** A repeatable value in 0..1 for dot i and property k, so every run draws the same field. */
export function noise(i: number, k: number): number {
  'worklet'
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function createDots(view: ViewSize): Dot[] {
  'worklet'
  const columns = Math.max(1, Math.round(view.width / DOT_SPACING))
  const rows = Math.max(1, Math.round(view.height / DOT_SPACING))
  const cellWidth = view.width / columns
  const cellHeight = view.height / rows
  const dots: Dot[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = dots.length
      dots.push({
        homeX: (column + 0.5 + (noise(i, 1) - 0.5) * 2 * JITTER) * cellWidth,
        homeY: (row + 0.5 + (noise(i, 2) - 0.5) * 2 * JITTER) * cellHeight,
        ax: WANDER_MIN + (WANDER_MAX - WANDER_MIN) * noise(i, 3),
        ay: WANDER_MIN + (WANDER_MAX - WANDER_MIN) * noise(i, 4),
        fx: 0.5 + 0.6 * noise(i, 5),
        fy: 0.5 + 0.6 * noise(i, 6),
        px: noise(i, 7) * 2 * Math.PI,
        py: noise(i, 8) * 2 * Math.PI,
        size: 0.75 + 0.5 * noise(i, 9),
        tw: 1.2 + 2.2 * noise(i, 10),
      })
    }
  }
  return dots
}

/** Two sine waves per axis, weighted 2 : 1, so the offset never passes the amplitude. */
export function wander(dot: Dot, t: number): Point {
  'worklet'
  return {
    x: dot.ax * ((2 / 3) * Math.sin(dot.fx * t + dot.px) + (1 / 3) * Math.sin(2.3 * dot.fx * t + dot.py)),
    y: dot.ay * ((2 / 3) * Math.sin(dot.fy * t + dot.py) + (1 / 3) * Math.sin(1.9 * dot.fy * t + dot.px)),
  }
}

export function twinkle(dot: Dot, t: number): number {
  'worklet'
  return 1 + TWINKLE * Math.sin(dot.tw * t + dot.px * 3)
}
