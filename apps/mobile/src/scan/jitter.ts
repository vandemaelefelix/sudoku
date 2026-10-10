import type { Quad } from '../scanner'

/** Seconds of outline without a gap per report (QR-06). */
export const JITTER_WINDOW = 5

export type JitterWindow = { start: number; previous: Quad | null; maxStep: number; frames: number }

export const EMPTY_JITTER: JitterWindow = { start: -1, previous: null, maxStep: 0, frames: 0 }

/** maxStep: the largest distance, in view points, that one corner moved between two frames. */
export type JitterReport = { maxStep: number; frames: number; seconds: number }

/** quad: the drawn outline in view points. A gap in the outline starts a new window. */
export function trackJitter(
  window: JitterWindow,
  quad: Quad | null,
  timestamp: number,
): { window: JitterWindow; report: JitterReport | null } {
  'worklet'
  if (quad == null || window.previous == null || timestamp < window.start) {
    return { window: { start: timestamp, previous: quad, maxStep: 0, frames: 0 }, report: null }
  }
  let step = 0
  for (let i = 0; i < 4; i++) {
    step = Math.max(step, Math.hypot(quad[i].x - window.previous[i].x, quad[i].y - window.previous[i].y))
  }
  const maxStep = Math.max(window.maxStep, step)
  const frames = window.frames + 1
  const seconds = timestamp - window.start
  if (seconds >= JITTER_WINDOW) {
    return { window: { start: timestamp, previous: quad, maxStep: 0, frames: 0 }, report: { maxStep, frames, seconds } }
  }
  return { window: { start: window.start, previous: quad, maxStep, frames }, report: null }
}
