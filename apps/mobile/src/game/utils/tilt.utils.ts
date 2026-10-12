import { MAX_ROTATE_X, MAX_ROTATE_Y, TILT_RANGE } from '@/game/constants/tilt.constants'

export type Attitude = { pitch: number; roll: number }
/** Each axis from -1 to 1. */
export type Tilt = { x: number; y: number }

function clampUnit(value: number): number {
  'worklet'
  return Math.min(1, Math.max(-1, value))
}

/** A real attitude is a unit quaternion. Before its first value, the sensor gives zeros. */
export function isReading(value: { qw: number; qx: number; qy: number; qz: number }): boolean {
  'worklet'
  return value.qw * value.qw + value.qx * value.qx + value.qy * value.qy + value.qz * value.qz > 0.5
}

export function tiltOf(now: Attitude, rest: Attitude): Tilt {
  'worklet'
  return { x: clampUnit((now.roll - rest.roll) / TILT_RANGE), y: clampUnit((now.pitch - rest.pitch) / TILT_RANGE) }
}

/** Degrees. The top of the card turns away when the top of the phone turns away. */
export function cardRotation(tilt: Tilt): { rotateX: number; rotateY: number } {
  'worklet'
  return { rotateX: -tilt.y * MAX_ROTATE_X, rotateY: tilt.x * MAX_ROTATE_Y }
}
