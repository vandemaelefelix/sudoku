import { SPLASH_SPEED } from './transition.constants'

/** The time of the splash wave, at ms since the theme switched. */
export function splashMs(ms: number): number {
  'worklet'
  return Math.max(0, ms) * SPLASH_SPEED
}
