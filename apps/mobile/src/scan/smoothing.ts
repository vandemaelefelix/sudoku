import type { Point, Quad } from '@/utils/geometry.utils'

// One Euro filter (Casiez et al., CHI 2012): strong smoothing when still, little lag when moving.
// Units: normalised frame coordinates and seconds. Targets QR-06.

/** Hz. The cutoff of a still corner. Lower is steadier. */
export const MIN_CUTOFF = 0.5
/** Hz per (normalised unit per second). Higher follows fast moves with less lag. */
export const BETA = 120
/** Hz. The cutoff of the speed estimate. */
export const DERIVATIVE_CUTOFF = 1
/** Seconds. The outline stays this long after the last detection. */
export const HOLD = 0.25

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
