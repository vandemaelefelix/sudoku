import type { Scene } from '@/scan/effects/scene'

/** start: seconds on the frame clock when the effect was created. */
export type Clock = { start: number }

export function createClock(scene: Scene): Clock {
  'worklet'
  return { start: scene.t }
}

/**
 * Seconds since the effect was created, and 0 under Reduce Motion, which stops shader time.
 * A float uniform loses precision on the raw frame clock, so shaders get this small value.
 */
export function effectTime(clock: Clock, scene: Scene): number {
  'worklet'
  return scene.reduceMotion ? 0 : scene.t - clock.start
}
