import type { SharedValue } from 'react-native-reanimated'
import { lerpQuad, type Quad } from '@/utils/geometry.utils'
import { type Homography, quadToQuad } from '@/utils/homography.utils'
import { easeOut } from '@/utils/motion.utils'
import {
  TRANSITION_END,
  REDUCED_END,
  GATE_PHOTO,
  GATE_RESULTS,
  MAX_CLOCK_STEP,
  SPINNER_DELAY,
} from '@/scan/constants/transition.constants'

// Seconds from lock-on. docs/architecture/00-concepts/scan-pipeline.md describes the stages.

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

/** ramp eases in and out, for a layer that moves on the screen. rampOut eases out, for a layer that enters. */
function rampOut(t: number, from: number, to: number): number {
  'worklet'
  return easeOut(Math.min(1, Math.max(0, (t - from) / (to - from))))
}

/**
 * Seconds by which the digit sweep, the rings, the panel and the end move later, so that no digit pops in.
 * resultsAt: the clock value when the results gate opened, or below 0 while it is closed; then t stands in for it.
 */
export function sweepShift(resultsAt: number, t: number, crossFade: boolean): number {
  'worklet'
  if (crossFade) return 0
  return Math.max(0, (resultsAt < 0 ? t : resultsAt) - DIGIT_SWEEP_START)
}

/** shift: see sweepShift. The cross-fade ignores it. */
export function transitionEnd(crossFade: boolean, shift = 0): number {
  'worklet'
  return crossFade ? REDUCED_END : TRANSITION_END + shift
}

export function ringsAt(t: number, crossFade: boolean, shift = 0): number {
  'worklet'
  return crossFade ? ramp(t, 0, REDUCED_END) : rampOut(t - shift, 1.2, 1.4)
}

export function panelAt(t: number, crossFade: boolean, shift = 0): number {
  'worklet'
  return crossFade ? ramp(t, 0, REDUCED_END) : rampOut(t - shift, 1.2, 1.5)
}

export function transitionAt(t: number, crossFade: boolean, shift = 0): Channels {
  'worklet'
  if (crossFade) {
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
    title: ramp(t, 0.2, 0.5),
    rings: ringsAt(t, false, shift),
    panel: panelAt(t, false, shift),
  }
}

export function digitAlpha(t: number, row: number, col: number, crossFade: boolean, shift = 0): number {
  'worklet'
  if (crossFade) return ramp(t, 0, REDUCED_END)
  const start = DIGIT_SWEEP_START + shift + DIGIT_STEP * (row + col)
  return ramp(t, start, start + DIGIT_FADE)
}

/**
 * The next clock time: t + dt, held at a closed gate (GATE_PHOTO, then GATE_RESULTS; in the cross-fade both gates are at 0).
 * A negative dt counts as 0. shift: see sweepShift.
 */
export function advanceClock(t: number, dt: number, gates: Gates, crossFade: boolean, shift = 0): number {
  'worklet'
  let limit = transitionEnd(crossFade, shift)
  const photoGate = crossFade ? 0 : GATE_PHOTO
  const resultsGate = crossFade ? 0 : GATE_RESULTS
  // A switch to the cross-fade moves the gates to 0. The photo gate then does not pull the clock back.
  if (!gates.photo && t <= photoGate) limit = Math.min(limit, photoGate)
  // Only the results end the transition, so a closed results gate holds the clock where it is, also past the gate.
  if (!gates.results) limit = Math.min(limit, Math.max(t, resultsGate))
  return Math.min(t + Math.max(0, dt), limit)
}

/**
 * True when the clock has reached the results gate, in the cross-fade at any value, and without a clock (the review phase).
 * A failure keeps the gate closed, so the failure panel and its haptic use this instead of the clock ramp.
 */
export function resultsGateReached(clockValue: number | undefined, crossFade: boolean): boolean {
  'worklet'
  return clockValue === undefined || crossFade || clockValue >= GATE_RESULTS - 1e-6
}

/** Maps photo pixels (photoWidth × photoHeight, upright) to view points so that the normalised locked quad lands on screenQuad. */
export function photoMatrix(photoWidth: number, photoHeight: number, locked: Quad, screenQuad: Quad): number[] | null {
  'worklet'
  const inPixels = locked.map((p) => ({ x: p.x * photoWidth, y: p.y * photoHeight })) as Quad
  return quadToQuad(inPixels, screenQuad)
}

/**
 * What a cell, a ring or the panel of the correction screen follows. Without a clock, everything shows (the review phase).
 * crossFade: the transition has no movement, so the layers fade (the cross-fade path of the scan pipeline concept).
 */
export type SweepTiming = {
  clock?: SharedValue<number> | undefined
  resultsAt?: SharedValue<number> | undefined
  crossFade: boolean
}

/** The sweep shift at clock time t. 0 before the results arrive. */
export function shiftOf(t: number, resultsAt: SharedValue<number> | undefined, crossFade: boolean): number {
  'worklet'
  return resultsAt ? sweepShift(resultsAt.value, t, crossFade) : 0
}

/** m with the unit square shrunk by inset points on each side of a square of side points, so the last frame matches the board. */
export function insetUnit(m: Homography, inset: number, side: number): Homography {
  'worklet'
  const a = (side - 2 * inset) / side
  const b = inset / side
  const c = (m[6] + m[7]) * b + 1
  return [
    (m[0] * a) / c,
    (m[1] * a) / c,
    ((m[0] + m[1]) * b + m[2]) / c,
    (m[3] * a) / c,
    (m[4] * a) / c,
    ((m[3] + m[4]) * b + m[5]) / c,
    (m[6] * a) / c,
    (m[7] * a) / c,
  ]
}

/**
 * One frame of the transition, in view points. quad: the grid of the dots and the photo. grid: the grid of the cells and the lines.
 * They are the same quad in the warp. In the cross-fade the dots stay on the locked grid, and the cells and lines are on the square.
 * crossFade: true when the Reduce Motion channels fade the layers, also without Reduce Motion.
 */
export type CaptureFrame = { quad: Quad; grid: Quad; channels: Channels; crossFade: boolean }

/**
 * from: the locked grid in view points. to: the grid square of the correction screen. version: changes with each new plan, so the
 * clock publishes the frame again while it holds at a gate.
 */
export type TransitionPlan = { from: Quad; to: Quad; crossFade: boolean; version: number }

/**
 * What the clock keeps from one frame to the next. clock: seconds since lock-on. resultsAt: the clock value when the results gate
 * opened, or -1. held: seconds that the results gate has held the clock.
 */
export type ClockState = { clock: number; resultsAt: number; held: number }

/** The next state, with shift (see sweepShift), late (the gate held longer than SPINNER_DELAY) and done (the transition ended). */
export type ClockStep = ClockState & { shift: number; late: boolean; done: boolean }

/** Seconds from the previous frame to this one, at most MAX_CLOCK_STEP. previous below 0: no frame came yet, so the step is 0. */
export function frameStep(now: number, previous: number): number {
  'worklet'
  return previous < 0 ? 0 : Math.min(MAX_CLOCK_STEP, Math.max(0, now - previous))
}

/**
 * The clock after dt seconds. The first step with an open results gate fixes resultsAt, and later steps keep it. The end needs
 * an ok result, so done waits for the open results gate.
 */
export function stepClockState(state: ClockState, dt: number, gates: Gates, crossFade: boolean): ClockStep {
  'worklet'
  const resultsAt = gates.results && state.resultsAt < 0 ? state.clock : state.resultsAt
  const shift = sweepShift(resultsAt, state.clock, crossFade)
  const clock = advanceClock(state.clock, dt, gates, crossFade, shift)
  const resultsGate = crossFade ? 0 : GATE_RESULTS
  const held = !gates.results && clock >= resultsGate ? state.held + dt : 0
  return {
    clock,
    resultsAt,
    held,
    shift,
    late: held > SPINNER_DELAY,
    done: gates.results && clock >= transitionEnd(crossFade, shift),
  }
}

/** The frame at clock time t. shift: see sweepShift. */
export function frameAt(t: number, shift: number, plan: TransitionPlan): CaptureFrame {
  'worklet'
  const channels = transitionAt(t, plan.crossFade, shift)
  const grid = plan.crossFade ? plan.to : lerpQuad(plan.from, plan.to, channels.flatten)
  return { quad: plan.crossFade ? plan.from : grid, grid, channels, crossFade: plan.crossFade }
}
