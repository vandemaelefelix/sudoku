import type { Scene } from '@/scan/effects/scene'

/** Seconds since lock-on, or -1: the prototype's uLockT. */
export function lockTime(scene: Scene): number {
  'worklet'
  return scene.lockedAt < 0 ? -1 : scene.t - scene.lockedAt
}
