import {
  GLIDE_MS,
  GLIDE_START_MS,
  GLOW_MS,
  GLOW_PEAK_AT,
  GRID_COLUMNS,
  GROUND_FADE_END_MS,
  GROUND_FADE_START_MS,
  HANDOFF_AT_MS,
  HANDOFF_MS,
  HOLD_MS,
  JITTER_MS,
  LETTER_RISE_BY,
  LETTER_RISE_MS,
  LETTER_STEP_MS,
  ROW_STEP_MS,
} from '@/splash/constants/splash.constants'
import type { Theme } from '@/theme/theme.types'
import { easeInOut, easeOut } from '@/utils/motion.utils'

/** 0..1: how far ms is from `from` to `to`. */
function ramp(ms: number, from: number, to: number): number {
  'worklet'
  return Math.min(1, Math.max(0, (ms - from) / (to - from)))
}

/** 0 up to, not including, 1. The same cell gets the same value on every launch, so the wave looks the same. */
export function cellJitter(i: number, j: number): number {
  'worklet'
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(10, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** i: columns from the centre cell. j: rows from the centre cell, down is positive. delayMs: when the cell starts to glow, after the start of the exit. */
export type SplashCell = { i: number; j: number; delayMs: number }

/** size: the side of a cell in points. */
export type SplashGrid = { size: number; cells: readonly SplashCell[] }

/**
 * Nine columns across the window. The centre cell is the middle of the window.
 * The wave starts at the bottom row and rises, so a lower row starts earlier.
 */
export function splashGrid(width: number, height: number): SplashGrid {
  const size = width / GRID_COLUMNS
  const half = Math.floor(GRID_COLUMNS / 2)
  const rows = Math.ceil(height / (2 * size) - 0.5)
  const cells: SplashCell[] = []
  for (let j = -rows; j <= rows; j++) {
    for (let i = -half; i <= half; i++) {
      cells.push({ i, j, delayMs: ROW_STEP_MS * (rows - j) + JITTER_MS * cellJitter(i, j) })
    }
  }
  return { size, cells }
}

/** 0..1: how much a cell glows, sinceMs after its start. It rises to a peak and falls to 0. The shape of the finish pulse. */
export function glow(sinceMs: number): number {
  'worklet'
  const u = sinceMs / GLOW_MS
  if (u <= 0 || u >= 1) return 0
  if (u < GLOW_PEAK_AT) return Math.sin((u / GLOW_PEAK_AT) * (Math.PI / 2))
  return Math.cos(((u - GLOW_PEAK_AT) / (1 - GLOW_PEAK_AT)) * (Math.PI / 2))
}

/** The opacity and the offset in points of one letter, introMs after the mount. index: 0 for the first letter. */
export function letterRise(introMs: number, index: number): { opacity: number; translateY: number } {
  'worklet'
  const start = HOLD_MS + index * LETTER_STEP_MS
  const t = easeOut(ramp(introMs, start, start + LETTER_RISE_MS))
  return { opacity: t, translateY: (1 - t) * LETTER_RISE_BY }
}

/** 0..1: the glide of the word from the middle of the window to the title. */
export function glide(exitMs: number): number {
  'worklet'
  return easeInOut(ramp(exitMs, GLIDE_START_MS, GLIDE_START_MS + GLIDE_MS))
}

/** 1 down to 0: the opacity of the splash ground. */
export function groundOpacity(exitMs: number): number {
  'worklet'
  return 1 - easeInOut(ramp(exitMs, GROUND_FADE_START_MS, GROUND_FADE_END_MS))
}

/** 1 down to 0: the opacity of the word in the hand-off. */
export function wordOpacity(exitMs: number): number {
  'worklet'
  return 1 - ramp(exitMs, HANDOFF_AT_MS, HANDOFF_AT_MS + HANDOFF_MS)
}

/** The top left corner of the home title. HomeMenu places the title here. A test keeps the two the same. */
export function titleOrigin(space: Theme['space'], insetsTop: number): { x: number; y: number } {
  return { x: space.lg, y: insetsTop + space.xxl }
}
