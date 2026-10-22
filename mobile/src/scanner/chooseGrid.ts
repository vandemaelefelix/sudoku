import { cornerOffset } from './photoGeometry'
import type { GridDetection } from './quad'
import type { Quad } from '@/utils/geometry.utils'

// The aiming rule: the player chooses a grid by aiming at it (scan-pipeline concept, "Choosing the grid").

/** A grid smaller than this share of the area of the largest grid of the frame never counts, such as last week's solution. */
export const MIN_AREA_SHARE = 0.6
/** Another grid must be nearer the frame centre than the tracked grid by this share of the frame width. */
export const SWITCH_MARGIN = 0.15
/** Seconds the other grid must keep the margin before the chooser switches to it. */
export const SWITCH_DWELL = 0.3
/** Seconds the tracked grid may be gone. After it, the next detection is a first find. */
export const LOSS_HOLD = 0.25
/** A grid of this frame is the tracked grid when its corners lie within this share of the grid side, as in recognise. */
export const TRACK_TOLERANCE = 0.5

/**
 * tracked: the chosen grid, normalised to the upright frame, or null. seenAt: seconds, when the frame last held it.
 * candidate: another grid that is nearer the centre by the margin, and since when, in seconds.
 */
export type GridChoice = { tracked: Quad | null; seenAt: number; candidate: Quad | null; candidateSince: number }

export const NO_CHOICE: GridChoice = { tracked: null, seenAt: 0, candidate: null, candidateSince: 0 }

/** switched: the chooser moved to another grid in this frame. The overlay treats it as lost and found. */
export type ChosenGrid = { state: GridChoice; grid: GridDetection | null; switched: boolean }

/** aspect: width / height of the frame. The distance is in shares of the frame width, so the vertical share counts at 1 / aspect. */
function centreDistance(quad: Quad, aspect: number): number {
  'worklet'
  const x = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
  const y = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4
  return Math.hypot(x - 0.5, (y - 0.5) / aspect)
}

function bigEnough(grids: GridDetection[]): GridDetection[] {
  'worklet'
  let largest = 0
  for (const found of grids) largest = Math.max(largest, found.score)
  return grids.filter((found) => found.score >= MIN_AREA_SHARE * largest)
}

function nearestCentre(grids: GridDetection[], aspect: number, skip: GridDetection | null): GridDetection | null {
  'worklet'
  let best: GridDetection | null = null
  let bestDistance = Infinity
  for (const found of grids) {
    if (found === skip) continue
    const distance = centreDistance(found.quad, aspect)
    if (distance < bestDistance) {
      best = found
      bestDistance = distance
    }
  }
  return best
}

function nearestTo(grids: GridDetection[], quad: Quad, aspect: number): GridDetection | null {
  'worklet'
  let best: GridDetection | null = null
  let bestOffset = TRACK_TOLERANCE
  for (const found of grids) {
    const offset = cornerOffset(found.quad, quad, aspect, 1)
    if (offset <= bestOffset) {
      best = found
      bestOffset = offset
    }
  }
  return best
}

/**
 * The grid nearest the centre, of the grids that are at least MIN_AREA_SHARE of the largest. The live chooser uses it for a first
 * find. A still image and a shutter press without a grid have no aim, so they use only this rule. aspect: width / height.
 */
export function firstFind(grids: GridDetection[], aspect: number): GridDetection | null {
  'worklet'
  return nearestCentre(bigEnough(grids), aspect, null)
}

/**
 * One frame of the aiming rule. grids: every plausible grid of the frame. t: seconds, camera clock. aspect: width / height of the
 * upright frame. Pure: the caller keeps the state between frames.
 */
export function chooseGrid(state: GridChoice, grids: GridDetection[], t: number, aspect: number): ChosenGrid {
  'worklet'
  if (state.tracked == null || t - state.seenAt > LOSS_HOLD) {
    const found = firstFind(grids, aspect)
    if (found == null) return { state: NO_CHOICE, grid: null, switched: false }
    return {
      state: { tracked: found.quad, seenAt: t, candidate: null, candidateSince: t },
      grid: found,
      switched: false,
    }
  }
  const tracked = nearestTo(grids, state.tracked, aspect)
  // The tracked grid is out of this frame. No grid, so the outline does not jump to a neighbour during the hold.
  if (tracked == null) return { state: { ...state, candidate: null }, grid: null, switched: false }

  const other = nearestCentre(bigEnough(grids), aspect, tracked)
  const nearer =
    other != null && centreDistance(other.quad, aspect) + SWITCH_MARGIN <= centreDistance(tracked.quad, aspect)
  if (other == null || !nearer) {
    return {
      state: { tracked: tracked.quad, seenAt: t, candidate: null, candidateSince: t },
      grid: tracked,
      switched: false,
    }
  }
  // The dwell counts only while the same other grid keeps the margin.
  const since =
    state.candidate != null && nearestTo([other], state.candidate, aspect) != null ? state.candidateSince : t
  if (t - since >= SWITCH_DWELL) {
    return {
      state: { tracked: other.quad, seenAt: t, candidate: null, candidateSince: t },
      grid: other,
      switched: true,
    }
  }
  return {
    state: { tracked: tracked.quad, seenAt: t, candidate: other.quad, candidateSince: since },
    grid: tracked,
    switched: false,
  }
}
