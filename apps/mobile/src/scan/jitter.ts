import type { Quad } from '@/scanner'
import { MAX_GAP } from './frameRate'

/** Seconds of outline without a gap per report (QR-06). */
export const JITTER_WINDOW = 5

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
  const [q0, q1, q2, q3] = quad
  const [p0, p1, p2, p3] = window.previous
  const step = Math.max(
    0,
    Math.hypot(q0.x - p0.x, q0.y - p0.y),
    Math.hypot(q1.x - p1.x, q1.y - p1.y),
    Math.hypot(q2.x - p2.x, q2.y - p2.y),
    Math.hypot(q3.x - p3.x, q3.y - p3.y),
  )
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
