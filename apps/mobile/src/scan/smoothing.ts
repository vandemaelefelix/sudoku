import type { Point, Quad } from '../scanner'

// One Euro filter (Casiez et al., CHI 2012): strong smoothing when still, little lag when moving.
// Units: normalised frame coordinates and seconds. Tuned against QR-06.

/** Hz. The cutoff of a still corner. Lower is steadier. */
export const MIN_CUTOFF = 1
/** Hz per (normalised unit per second). Higher follows fast moves with less lag. */
export const BETA = 20
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
  const next: Point[] = []
  const velocity: Point[] = []
  for (let i = 0; i < 4; i++) {
    const previous = state.quad[i]
    const vx = state.velocity[i].x + derivativeAlpha * ((quad[i].x - previous.x) / dt - state.velocity[i].x)
    const vy = state.velocity[i].y + derivativeAlpha * ((quad[i].y - previous.y) / dt - state.velocity[i].y)
    next.push({
      x: previous.x + alpha(MIN_CUTOFF + BETA * Math.abs(vx), dt) * (quad[i].x - previous.x),
      y: previous.y + alpha(MIN_CUTOFF + BETA * Math.abs(vy), dt) * (quad[i].y - previous.y),
    })
    velocity.push({ x: vx, y: vy })
  }
  return { quad: next as Quad, velocity: velocity as Quad, timestamp }
}
