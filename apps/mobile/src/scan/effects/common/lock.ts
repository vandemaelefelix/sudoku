import type { Scene } from '../scene'

// Lock-on does not exist yet (scan-pipeline concept, open questions). The prototype's lock-on progress and lock-on time are
// approximated from the steady state, so each effect shows its lock-on reaction when the corners hold still.

/** 0..1: the prototype's lock-on progress p. */
export function lockProgress(scene: Scene): number {
  'worklet'
  return scene.presence * (1 - scene.motion)
}

/** Seconds since the scene became steady, or -1: the prototype's uLockT. */
export function lockTime(scene: Scene): number {
  'worklet'
  return scene.steady ? scene.t - scene.steadyAt : -1
}
