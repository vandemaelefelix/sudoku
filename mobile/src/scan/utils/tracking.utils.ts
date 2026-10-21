import { largestCornerStep, type Point, type Quad } from '@/utils/geometry.utils'
import { MAX_GAP, MIN_CUTOFF, BETA, DERIVATIVE_CUTOFF, HOLD, JITTER_WINDOW } from '@/scan/constants/tracking.constants'

// Counts camera frames in windows of at least one second. Runs as a worklet on the camera thread.

/** detectionMs: the sum over the frames of the window. */
export type FrameWindow = { start: number; last: number; frames: number; detectionMs: number }

export const EMPTY_WINDOW: FrameWindow = { start: -1, last: -1, frames: 0, detectionMs: 0 }

/** detectionMs: the grid detection time of this frame. The report gives the mean of the window. */
export function countFrame(
  window: FrameWindow,
  timestamp: number,
  detectionMs: number,
): { window: FrameWindow; report: { fps: number; detectionMs: number } | null } {
  'worklet'
  if (window.start < 0 || timestamp < window.last || timestamp - window.last > MAX_GAP) {
    return { window: { start: timestamp, last: timestamp, frames: 0, detectionMs: 0 }, report: null }
  }
  const frames = window.frames + 1
  const total = window.detectionMs + detectionMs
  const elapsed = timestamp - window.start
  if (elapsed >= 1) {
    return {
      window: { start: timestamp, last: timestamp, frames: 0, detectionMs: 0 },
      report: { fps: frames / elapsed, detectionMs: total / frames },
    }
  }
  return { window: { start: window.start, last: timestamp, frames, detectionMs: total }, report: null }
}

// One Euro filter (Casiez et al., CHI 2012): strong smoothing when still, little lag when moving.
// Units: normalised frame coordinates and seconds. Targets QR-06.

/** velocity: per corner, in normalised units per second. timestamp: the last detection. */
export type Smoothing = { quad: Quad; velocity: Quad; timestamp: number }

const STILL: Quad = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
]

function alpha(cutoff: number, dt: number): number {
  'worklet'
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

type Corner = { point: Point; velocity: Point }

function smoothCorner(previous: Point, velocity: Point, target: Point, dt: number, derivativeAlpha: number): Corner {
  'worklet'
  const vx = velocity.x + derivativeAlpha * ((target.x - previous.x) / dt - velocity.x)
  const vy = velocity.y + derivativeAlpha * ((target.y - previous.y) / dt - velocity.y)
  return {
    point: {
      x: previous.x + alpha(MIN_CUTOFF + BETA * Math.abs(vx), dt) * (target.x - previous.x),
      y: previous.y + alpha(MIN_CUTOFF + BETA * Math.abs(vy), dt) * (target.y - previous.y),
    },
    velocity: { x: vx, y: vy },
  }
}

/** Null means: no outline. */
export function smoothQuad(state: Smoothing | null, quad: Quad | null, timestamp: number): Smoothing | null {
  'worklet'
  if (quad == null) {
    return state != null && timestamp - state.timestamp <= HOLD ? state : null
  }
  if (state == null || timestamp <= state.timestamp || timestamp - state.timestamp > HOLD) {
    return { quad, velocity: STILL, timestamp }
  }
  const dt = timestamp - state.timestamp
  const derivativeAlpha = alpha(DERIVATIVE_CUTOFF, dt)
  const [p0, p1, p2, p3] = state.quad
  const [v0, v1, v2, v3] = state.velocity
  const [t0, t1, t2, t3] = quad
  const c0 = smoothCorner(p0, v0, t0, dt, derivativeAlpha)
  const c1 = smoothCorner(p1, v1, t1, dt, derivativeAlpha)
  const c2 = smoothCorner(p2, v2, t2, dt, derivativeAlpha)
  const c3 = smoothCorner(p3, v3, t3, dt, derivativeAlpha)
  return {
    quad: [c0.point, c1.point, c2.point, c3.point],
    velocity: [c0.velocity, c1.velocity, c2.velocity, c3.velocity],
    timestamp,
  }
}

export type JitterWindow = { start: number; last: number; previous: Quad | null; maxStep: number; frames: number }

export const EMPTY_JITTER: JitterWindow = { start: -1, last: -1, previous: null, maxStep: 0, frames: 0 }

/** maxStep: the largest distance, in view points, that one corner moved between two frames. */
export type JitterReport = { maxStep: number; frames: number; seconds: number }

/** quad: the drawn outline in view points. A missing outline, a clock that goes back or a gap longer than MAX_GAP starts a new window. */
export function trackJitter(
  window: JitterWindow,
  quad: Quad | null,
  timestamp: number,
): { window: JitterWindow; report: JitterReport | null } {
  'worklet'
  if (quad == null || window.previous == null || timestamp < window.last || timestamp - window.last > MAX_GAP) {
    return { window: { start: timestamp, last: timestamp, previous: quad, maxStep: 0, frames: 0 }, report: null }
  }
  const step = largestCornerStep(quad, window.previous)
  const maxStep = Math.max(window.maxStep, step)
  const frames = window.frames + 1
  const seconds = timestamp - window.start
  if (seconds >= JITTER_WINDOW) {
    return {
      window: { start: timestamp, last: timestamp, previous: quad, maxStep: 0, frames: 0 },
      report: { maxStep, frames, seconds },
    }
  }
  return { window: { start: window.start, last: timestamp, previous: quad, maxStep, frames }, report: null }
}
