// Seconds from lock-on. docs/architecture/00-concepts/scan-pipeline.md describes the stages.

export const TRANSITION_END = 1.5
export const REDUCED_END = 0.3
/** The clock waits here until the photo is a Skia image. */
export const GATE_PHOTO = 0.05
/** The clock waits here until `recognise()` returns. */
export const GATE_RESULTS = 0.7
/** Seconds the results gate may hold before a spinner shows. */
export const SPINNER_DELAY = 1

export type Gates = { photo: boolean; results: boolean }

/** Every value is 0..1. digit is read with digitAlpha. */
export type Channels = {
  flash: number
  pulse: number
  flatten: number
  freeDrift: number
  dim: number
  ink: number
  cells: number
  lines: number
  photo: number
  shrink: number
  title: number
  rings: number
  panel: number
}

const DIGIT_SWEEP_START = 0.55
const DIGIT_STEP = 0.028
const DIGIT_FADE = 0.15

function ramp(t: number, from: number, to: number): number {
  'worklet'
  const x = Math.min(1, Math.max(0, (t - from) / (to - from)))
  return x * x * (3 - 2 * x)
}

export function transitionEnd(reduceMotion: boolean): number {
  'worklet'
  return reduceMotion ? REDUCED_END : TRANSITION_END
}

export function transitionAt(t: number, reduceMotion: boolean): Channels {
  'worklet'
  if (reduceMotion) {
    const f = ramp(t, 0, REDUCED_END)
    // The caller draws the photo in place, so flatten stays at 1 and nothing moves.
    return {
      flash: 0,
      pulse: 0,
      flatten: 1,
      freeDrift: f,
      dim: f,
      ink: f,
      cells: f,
      lines: f,
      photo: 1 - f,
      shrink: f,
      title: f,
      rings: f,
      panel: f,
    }
  }
  return {
    flash: 1 - ramp(t, 0, 0.25),
    pulse: Math.sin(Math.PI * ramp(t, 0, 0.25)),
    flatten: ramp(t, 0.05, 0.5),
    freeDrift: ramp(t, 0.05, 0.45),
    dim: ramp(t, 0.05, 0.5),
    ink: ramp(t, 0.15, 0.45),
    cells: ramp(t, 0.3, 0.55),
    lines: ramp(t, 0.35, 0.7),
    photo: 1 - ramp(t, 0.5, 0.8),
    shrink: ramp(t, 0.65, 0.95),
    title: ramp(t, 0.5, 0.8),
    rings: ramp(t, 1.2, 1.4),
    panel: ramp(t, 1.2, 1.5),
  }
}

export function digitAlpha(t: number, row: number, col: number, reduceMotion: boolean): number {
  'worklet'
  if (reduceMotion) return ramp(t, 0, REDUCED_END)
  const start = DIGIT_SWEEP_START + DIGIT_STEP * (row + col)
  return ramp(t, start, start + DIGIT_FADE)
}

/** The next clock time: t + dt, held at a closed gate (GATE_PHOTO, then GATE_RESULTS; with Reduce Motion both gates are at 0). */
export function advanceClock(t: number, dt: number, gates: Gates, reduceMotion: boolean): number {
  'worklet'
  let limit = transitionEnd(reduceMotion)
  const photoGate = reduceMotion ? 0 : GATE_PHOTO
  const resultsGate = reduceMotion ? 0 : GATE_RESULTS
  // A gate that the clock has already passed does not pull the clock back.
  if (!gates.photo && t <= photoGate) limit = Math.min(limit, photoGate)
  if (!gates.results && t <= resultsGate) limit = Math.min(limit, resultsGate)
  return Math.min(t + dt, limit)
}
