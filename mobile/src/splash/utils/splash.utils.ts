import {
  DIGIT_SHARE,
  GLOW_MS,
  GLOW_PEAK_AT,
  GROUND_FADE_MS,
  GRID_COLUMNS,
  HOLD_MS,
  JITTER_MS,
  LETTER_RISE_BY,
  LETTER_RISE_MS,
  LETTER_STEP_MS,
  REVEAL_BAND,
  REVEAL_LAG_MS,
  ROW_STEP_MS,
  WORD_FADE_MS,
  WORD_FADE_START_MS,
  WORD_RISE_BY,
} from '@/splash/constants/splash.constants'
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

/**
 * The digit of a cell, 1 to 9, or null for an empty cell. The digits follow a valid sudoku pattern, so no row,
 * column or box of the grid repeats a digit. About DIGIT_SHARE of the cells show one, like the givens of a puzzle.
 */
export function splashDigit(i: number, j: number): number | null {
  'worklet'
  if (cellJitter(i + 11, j - 5) >= DIGIT_SHARE) return null
  const row = ((j % 9) + 9) % 9
  const col = i + Math.floor(GRID_COLUMNS / 2)
  return ((col + 3 * (row % 3) + Math.floor(row / 3)) % 9) + 1
}

/** 0..1: how much a cell glows, sinceMs after its start. It rises to a peak and falls to 0. The shape of the finish pulse. */
export function glow(sinceMs: number): number {
  'worklet'
  const u = sinceMs / GLOW_MS
  if (u <= 0 || u >= 1) return 0
  if (u < GLOW_PEAK_AT) return Math.sin((u / GLOW_PEAK_AT) * (Math.PI / 2))
  return Math.cos(((u - GLOW_PEAK_AT) / (1 - GLOW_PEAK_AT)) * (Math.PI / 2))
}

/** 0..1: how much of the page colour of the saved look covers the white of the native splash, introMs after the mount. */
export function groundFade(introMs: number): number {
  'worklet'
  return easeOut(ramp(introMs, 0, GROUND_FADE_MS))
}

/** The opacity and the offset in points of one letter, introMs after the mount. index: 0 for the first letter. */
export function letterRise(introMs: number, index: number): { opacity: number; translateY: number } {
  'worklet'
  const start = HOLD_MS + index * LETTER_STEP_MS
  const t = easeOut(ramp(introMs, start, start + LETTER_RISE_MS))
  return { opacity: t, translateY: (1 - t) * LETTER_RISE_BY }
}

/** The opacity and the offset in points of the word in the exit. It rises and fades out. */
export function wordFade(exitMs: number): { opacity: number; translateY: number } {
  'worklet'
  const t = easeInOut(ramp(exitMs, WORD_FADE_START_MS, WORD_FADE_START_MS + WORD_FADE_MS))
  return { opacity: 1 - t, translateY: -WORD_RISE_BY * t }
}

/**
 * The y of the top of the gradient edge of the ground. The ground is solid above it and gone REVEAL_BAND points below it.
 * The edge starts under the window and rises as fast as the wave, after REVEAL_LAG_MS.
 */
export function groundEdge(exitMs: number, height: number, cellSize: number): number {
  'worklet'
  return height + REVEAL_BAND * 0.2 - Math.max(0, exitMs - REVEAL_LAG_MS) * (cellSize / ROW_STEP_MS)
}

/**
 * True from the peak of the glow of a cell, sinceMs after its start. The cell is solid then. A theme switch erases the
 * picture of the old screen in a cell from this time on. It does not erase it before, so a cell that the wave has not
 * reached shows the old screen.
 */
export function cellPassed(sinceMs: number): boolean {
  'worklet'
  return sinceMs >= GLOW_MS * GLOW_PEAK_AT
}
